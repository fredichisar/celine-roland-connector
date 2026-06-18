/**
 * Réconciliation automatique : matche les produits Optimum avec les variantes Shopify existantes par SKU.
 * Les produits "pending" dont le SKU correspond à une variante Shopify passent en "synced" avec le lien shopifyProduct.
 */

/** @type { ActionRun } */
export const run = async ({ logger, api }) => {
  const connection = await api.erpConnection.maybeFindFirst({
    filter: { isActive: { equals: true } },
    select: { shop: { id: true } },
  });

  const shopId = connection?.shop?.id;
  if (!shopId) {
    return { success: false, message: "No active ERP connection" };
  }

  const pendingProducts = await api.internal.optimumProduct.findMany({
    filter: {
      syncStatus: { equals: "pending" },
      shopId: { equals: shopId },
    },
    first: 250,
    select: { id: true, codeArticle: true },
  });

  if (pendingProducts.length === 0) {
    return { success: true, reconciled: 0, message: "No pending products to reconcile" };
  }

  let reconciled = 0;
  const errors = [];

  for (const product of pendingProducts) {
    try {
      const variant = await api.internal.shopifyProductVariant.findMany({
        filter: {
          sku: { equals: product.codeArticle },
          shopId: { equals: shopId },
        },
        first: 1,
        select: { id: true, productId: true },
      });

      if (variant.length > 0 && variant[0].productId) {
        await api.internal.optimumProduct.update(product.id, {
          syncStatus: "synced",
          shopifyProduct: { _link: variant[0].productId },
          lastSyncedAt: new Date(),
        });
        reconciled++;
        logger.info({ codeArticle: product.codeArticle, shopifyProductId: variant[0].productId }, "Product reconciled");
      }
    } catch (err) {
      errors.push({ codeArticle: product.codeArticle, message: err.message });
      logger.warn({ codeArticle: product.codeArticle, error: err.message }, "Failed to reconcile product");
    }
  }

  logger.info({ total: pendingProducts.length, reconciled, errors: errors.length }, "reconcileProducts completed");

  return { success: true, total: pendingProducts.length, reconciled, errors: errors.length };
};

export const params = {};
