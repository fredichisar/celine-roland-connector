import { logSyncOperation } from "../utils/erp-log";

const PRODUCT_SET = `
  mutation productSet($input: ProductSetInput!) {
    productSet(synchronous: true, input: $input) {
      product {
        id
        title
        status
        variants(first: 1) {
          edges {
            node {
              id
              sku
              price
              inventoryItem { id }
            }
          }
        }
      }
      userErrors { code field message }
    }
  }
`;

const METAFIELDS_SET = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { code field message }
    }
  }
`;

const INVENTORY_SET_QUANTITIES = `
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup { reason }
      userErrors { code field message }
    }
  }
`;

/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections }) => {
  const { productIds } = params;

  if (!productIds || productIds.length === 0) {
    return { success: false, message: "No product IDs provided" };
  }

  const startedAt = new Date();

  const connection = await api.erpConnection.maybeFindFirst({
    filter: { isActive: { equals: true } },
    select: { id: true, shop: { id: true } },
  });

  if (!connection) {
    return { success: false, message: "No active ERP connection" };
  }

  const shopify = await connections.shopify.forShopId(connection.shop.id);

  const location = await api.shopifyLocation.maybeFindFirst({
    filter: { active: { equals: true } },
    select: { id: true },
  });
  const locationGid = location ? `gid://shopify/Location/${location.id}` : null;

  let accepted = 0;
  const errors = [];

  for (const productId of productIds) {
    try {
      const op = await api.optimumProduct.findOne(productId, {
        select: {
          id: true,
          codeArticle: true,
          nomArticle: true,
          codeEan: true,
          marque: true,
          prixAchat: true,
          prixVente: true,
          quantiteDisponible: true,
          spec: true,
          shopifyProduct: { id: true },
        },
      });

      const existingShopifyId = op.shopifyProduct?.id;
      const isUpdate = !!existingShopifyId;

      const productInput = {
        status: "DRAFT",
        productOptions: [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
        variants: [{
          sku: op.codeArticle,
          barcode: op.codeEan || undefined,
          price: op.prixVente ? String(op.prixVente) : "0.00",
          optionValues: [{ optionName: "Title", name: "Default Title" }],
          inventoryItem: {
            cost: op.prixAchat ? String(op.prixAchat) : undefined,
            tracked: true,
            countryCodeOfOrigin: "FR",
            harmonizedSystemCode: "90031900",
          },
        }],
      };

      if (isUpdate) {
        productInput.id = `gid://shopify/Product/${existingShopifyId}`;
        // Safe update: only price, cost, barcode, SKU, inventory
        delete productInput.status;
        delete productInput.productOptions;
        productInput.variants[0].id = undefined; // let Shopify match by SKU
      } else {
        productInput.title = op.nomArticle;
        productInput.vendor = op.marque || undefined;
      }

      const result = await shopify.graphql(PRODUCT_SET, { input: productInput });

      if (result.productSet.userErrors.length > 0) {
        throw new Error(result.productSet.userErrors.map((e) => e.message).join(", "));
      }

      const shopifyProductGid = result.productSet.product.id;
      const variantNode = result.productSet.product.variants.edges[0]?.node;
      const inventoryItemId = variantNode?.inventoryItem?.id;

      // Set metafields (only on creation)
      if (!isUpdate) {
        const metafields = [];

        if (op.spec) {
          const specMapping = {
            style_de_monture: "style_monture",
            matiere_de_la_monture: "matiere",
            genre: "genre",
            type_de_monture: "type_monture",
            taille: "taille",
            code_coloris: "code_coloris",
            coloris: "coloris",
            longueur_des_branches: "longueur_branches",
          };
          for (const [apiKey, metaKey] of Object.entries(specMapping)) {
            if (op.spec[apiKey]) {
              metafields.push({
                ownerId: shopifyProductGid,
                namespace: "optimum",
                key: metaKey,
                type: "single_line_text_field",
                value: String(op.spec[apiKey]),
              });
            }
          }
        }

        metafields.push({
          ownerId: shopifyProductGid,
          namespace: "optimum",
          key: "fda_product_code",
          type: "single_line_text_field",
          value: "HQY886.5850",
        });

        if (metafields.length > 0) {
          await shopify.graphql(METAFIELDS_SET, { metafields });
        }
      }

      // Set inventory quantity
      if (locationGid && inventoryItemId && op.quantiteDisponible != null) {
        await shopify.graphql(INVENTORY_SET_QUANTITIES, {
          input: {
            name: "on_hand",
            reason: "correction",
            quantities: [{
              inventoryItemId,
              locationId: locationGid,
              quantity: op.quantiteDisponible,
            }],
          },
        });
      }

      // Update optimumProduct record
      const numericId = shopifyProductGid.replace("gid://shopify/Product/", "");
      await api.optimumProduct.update(productId, {
        syncStatus: "synced",
        syncError: null,
        lastSyncedAt: new Date(),
        shopifyProduct: { _link: numericId },
      });

      accepted++;
      logger.info({ codeArticle: op.codeArticle, shopifyProductId: numericId }, "Product pushed to Shopify");
    } catch (err) {
      logger.error({ productId, error: err.message }, "Failed to push product to Shopify");
      await api.optimumProduct.update(productId, {
        syncStatus: "error",
        syncError: err.message,
      });
      errors.push({ productId, message: err.message });
    }
  }

  await logSyncOperation(api, {
    connectionId: connection.id,
    shopId: connection.shop.id,
    syncType: "product",
    endpoint: "pushProductToShopify",
    received: productIds.length,
    accepted,
    errors,
    startedAt,
  });

  return { success: true, received: productIds.length, accepted, errors: errors.length };
};

export const params = {
  productIds: { type: "array", items: { type: "string" } },
};
