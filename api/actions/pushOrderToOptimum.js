import { createOptimumClient } from "../utils/optimum-client";
import { logSyncOperation } from "../utils/erp-log";

/** @type { ActionRun } */
export const run = async ({ params, logger, api, connections }) => {
  const { erpOrderId } = params;

  if (!erpOrderId) {
    return { success: false, message: "erpOrderId is required" };
  }

  const startedAt = new Date();

  const connection = await api.erpConnection.maybeFindFirst({
    filter: { isActive: { equals: true } },
    select: { id: true, apiKey: true, erpBaseUrl: true, shop: { id: true } },
  });

  if (!connection) {
    await api.erpOrder.update(erpOrderId, { status: "error", errorMessage: "No active ERP connection" });
    return { success: false, message: "No active ERP connection" };
  }

  const erpOrder = await api.erpOrder.findOne(erpOrderId, {
    select: { id: true, formattedPayload: true, status: true, orderNumber: true },
  });

  if (!erpOrder || !erpOrder.formattedPayload) {
    await api.erpOrder.update(erpOrderId, { status: "error", errorMessage: "No formatted payload" });
    return { success: false, message: "No formatted payload" };
  }

  const payload = erpOrder.formattedPayload;
  const client = createOptimumClient(connection);

  try {
    await api.erpOrder.update(erpOrderId, { status: "processing" });

    // --- 1. CLIENT: dédoublonnage par email ---
    const email = payload.email;
    let optimumClientId = null;

    if (email) {
      const existingClients = await client.getClients();
      const match = Array.isArray(existingClients)
        ? existingClients.find((c) => c.email && c.email.toLowerCase() === email.toLowerCase())
        : null;

      if (match) {
        optimumClientId = match.client_id;
        logger.info({ optimumClientId, email }, "Client found in Optimum");
      }
    }

    if (!optimumClientId) {
      const customer = payload.customer || {};
      const address = payload.shipping_address || payload.billing_address || {};

      const newClient = await client.createClient({
        civilite_type: "0",
        nom: (customer.last_name || "INCONNU").toUpperCase(),
        prenom: customer.first_name || "",
        email: email || "",
        ligne_1: address.address1 || "A compléter",
        ligne_2: address.address2 || "",
        code_postal: address.zip || "00000",
        ville: address.city || "A compléter",
        code_pays: address.country_code || "FR",
        indicatif_telephone_portable: "33",
        telephone_portable: customer.phone || address.phone || "",
      });

      if (Array.isArray(newClient) && newClient[0]) {
        optimumClientId = newClient[0].client_id;
        logger.info({ optimumClientId }, "Client created in Optimum");
      } else {
        throw new Error("Failed to create client in Optimum");
      }
    }

    // --- 2. VISITE: créer la visite ---
    const today = new Date();
    const datePrescription = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

    const visiteResult = await client.createVisite(optimumClientId, {
      utilisateur_id: 1981597,
      type_prescription: 1,
      date_prescription: datePrescription,
    });

    if (!visiteResult.status || !visiteResult.visite_id) {
      throw new Error(`Failed to create visite: ${visiteResult.message || "unknown error"}`);
    }

    const visiteId = visiteResult.visite_id;
    logger.info({ visiteId }, "Visite created in Optimum");

    // --- 3. OFFRE: matcher les line items et créer l'offre ---
    // Matching strategy (par ordre de priorité) :
    // 1. _code_article (property line item, posée par Thibault sur les verres)
    // 2. custom.code_article (metafield variante Shopify, peuplé sur 62% du catalogue)
    // 3. SKU (fallback)
    //
    // Articles avec lot_mouvement_id → articles_stock (montures en stock)
    // Articles sans lot_mouvement_id → articles_catalogues (verres du catalogue)
    const lineItems = payload.line_items || [];
    const articlesStock = [];
    const articlesCatalogues = [];
    const unmatchedItems = [];

    for (const item of lineItems) {
      // Priorité 1 : _code_article (property line item)
      let matchKey = item.code_article;

      // Priorité 2 : metafield custom.code_article sur la variante Shopify
      if (!matchKey && item.sku) {
        const variant = await api.shopifyProductVariant.maybeFindFirst({
          filter: {
            sku: { equals: item.sku },
            shopId: { equals: connection.shop.id },
          },
          select: { id: true },
        });
        if (variant) {
          const shopify = await connections.shopify.forShopId(connection.shop.id);
          try {
            const metafieldResult = await shopify.graphql(`query ($id: ID!) {
              productVariant(id: $id) {
                metafield(namespace: "custom", key: "code_article") { value }
              }
            }`, { id: `gid://shopify/ProductVariant/${variant.id}` });
            matchKey = metafieldResult?.productVariant?.metafield?.value || null;
          } catch (err) {
            logger.warn({ sku: item.sku, error: err.message }, "Failed to fetch code_article metafield");
          }
        }
      }

      // Priorité 3 : SKU comme fallback
      if (!matchKey) matchKey = item.sku;

      if (!matchKey) {
        unmatchedItems.push({ title: item.title, reason: "no code_article, no metafield, no SKU" });
        continue;
      }

      const optimumProduct = await api.optimumProduct.maybeFindFirst({
        filter: {
          codeArticle: { equals: matchKey },
          shopId: { equals: connection.shop.id },
        },
        select: {
          id: true,
          lotMouvementId: true,
          articleTypeId: true,
          codeFabricant: true,
          codeArticle: true,
          syncStatus: true,
        },
      });

      if (!optimumProduct) {
        unmatchedItems.push({
          sku: item.sku,
          code_article: matchKey,
          title: item.title,
          reason: `code_article "${matchKey}" not found in optimumProduct`,
        });
        continue;
      }

      const articleTypeId = parseInt(optimumProduct.articleTypeId, 10);
      const prixDeVente = parseFloat(item.price) || 0;

      for (let i = 0; i < (item.quantity || 1); i++) {
        if (optimumProduct.lotMouvementId) {
          // Article en stock (montures typiquement)
          articlesStock.push({
            lot_mouvement_id: optimumProduct.lotMouvementId,
            article_type_id: articleTypeId,
            prix_de_vente: prixDeVente,
          });
        } else {
          // Article catalogue (verres typiquement)
          articlesCatalogues.push({
            article_type_id: articleTypeId,
            code_article: optimumProduct.codeArticle,
            code_fabricant: optimumProduct.codeFabricant || "ESS",
            code_fournisseur: optimumProduct.codeFabricant || "ESS",
            prix_de_vente: prixDeVente,
            oeil: item.lens_type ? (i === 0 ? 1 : 2) : 0,
            diametre: 65,
          });
        }
      }
    }

    if (articlesStock.length === 0 && articlesCatalogues.length === 0) {
      throw new Error(`No matching products found. Unmatched: ${unmatchedItems.map((i) => i.code_article || i.sku || i.title).join(", ")}`);
    }

    const offreBody = {
      type_equipement: 1,
      type_prescription: 1,
      options_offre: {
        offre_remboursee: false,
        tiers_payant_ro: false,
        tiers_payant_rc_1: false,
        tiers_payant_rc_2: false,
        teletransmission_ro: false,
        teletransmission_rc_1: false,
      },
    };
    if (articlesStock.length > 0) offreBody.articles_stock = articlesStock;
    if (articlesCatalogues.length > 0) offreBody.articles_catalogues = articlesCatalogues;

    const offreResult = await client.createOffre(optimumClientId, visiteId, offreBody);

    if (!offreResult.status) {
      throw new Error(`Failed to create offre: ${offreResult.message || "unknown error"}`);
    }

    const offreId = offreResult.offre_id;
    const propositionId = offreResult.proposition_id;
    logger.info({ offreId, propositionId }, "Offre created in Optimum");

    // --- 4. UPDATE erpOrder: completed ---
    await api.erpOrder.update(erpOrderId, {
      status: "completed",
      errorMessage: null,
      acknowledgedAt: new Date(),
      formattedPayload: {
        ...payload,
        optimum_client_id: optimumClientId,
        optimum_visite_id: visiteId,
        optimum_offre_id: offreId,
        optimum_proposition_id: propositionId,
        unmatched_items: unmatchedItems.length > 0 ? unmatchedItems : undefined,
      },
    });

    // --- 5. LOG ---
    await logSyncOperation(api, {
      connectionId: connection.id,
      shopId: connection.shop.id,
      syncType: "order",
      endpoint: "pushOrderToOptimum",
      received: 1,
      accepted: 1,
      errors: [],
      startedAt,
    });

    logger.info({ orderNumber: erpOrder.orderNumber, optimumClientId, visiteId, offreId }, "Order pushed to Optimum successfully");

    // --- 6. NOTIFICATION EMAIL ---
    await api.enqueue(api.sendOrderNotification, { erpOrderId });

    return { success: true, optimumClientId, visiteId, offreId, propositionId };
  } catch (err) {
    logger.error({ erpOrderId, error: err.message }, "Failed to push order to Optimum");

    await api.erpOrder.update(erpOrderId, {
      status: "error",
      errorMessage: err.message,
    });

    await logSyncOperation(api, {
      connectionId: connection.id,
      shopId: connection.shop.id,
      syncType: "order",
      endpoint: "pushOrderToOptimum",
      received: 1,
      accepted: 0,
      errors: [{ orderNumber: erpOrder.orderNumber, message: err.message }],
      startedAt,
    });

    // Notification email même en cas d'erreur
    await api.enqueue(api.sendOrderNotification, { erpOrderId });

    return { success: false, message: err.message };
  }
};

export const params = {
  erpOrderId: { type: "string" },
};
