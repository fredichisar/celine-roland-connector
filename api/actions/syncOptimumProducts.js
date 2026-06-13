import { createOptimumClient } from "../utils/optimum-client";
import { logSyncOperation } from "../utils/erp-log";

/** @type { ActionRun } */
export const run = async ({ params, logger, api }) => {
  const startedAt = new Date();

  const connection = await api.erpConnection.maybeFindFirst({
    filter: { isActive: { equals: true } },
    select: { id: true, apiKey: true, erpBaseUrl: true, shop: { id: true } },
  });

  if (!connection) {
    return { success: false, message: "No active ERP connection" };
  }

  const client = createOptimumClient(connection);

  let stocks;
  try {
    stocks = await client.getStocks([1, 3, 4, 5]);
  } catch (err) {
    logger.error({ error: err.message }, "Failed to fetch stocks from Optimum");
    return { success: false, message: `Optimum API error: ${err.message}` };
  }

  if (!Array.isArray(stocks)) {
    return { success: false, message: "Unexpected response from Optimum API" };
  }

  let accepted = 0;
  const errors = [];

  for (const article of stocks) {
    try {
      const existing = await api.optimumProduct.maybeFindFirst({
        filter: { codeArticle: { equals: article.code_article } },
        select: { id: true, syncStatus: true },
      });

      const data = {
        codeArticle: article.code_article,
        lotMouvementId: article.lot_mouvement_id,
        nomArticle: article.nom_article,
        modele: article.modele || null,
        codeEan: article.code_ean || null,
        codeMarque: article.code_marque || null,
        marque: article.marque || null,
        codeFabricant: article.code_fabricant || null,
        nomFabricant: article.nom_fabricant || null,
        prixAchat: parseFloat(article.moy_prix_achat_catalogue) || null,
        prixVente: article.prix_de_vente ? parseFloat(String(article.prix_de_vente).replace(",", ".")) : null,
        quantiteDisponible: article.quantite_disponible ?? 0,
        articleTypeId: String(article.article_type_id),
        spec: article.spec || null,
        rawData: article,
        erpConnection: { _link: connection.id },
        shop: { _link: connection.shop.id },
      };

      if (existing) {
        await api.optimumProduct.update(existing.id, data);
      } else {
        await api.optimumProduct.create({ ...data, syncStatus: "pending" });
      }
      accepted++;
    } catch (err) {
      logger.warn({ codeArticle: article.code_article, error: err.message }, "Failed to upsert product");
      errors.push({ codeArticle: article.code_article, message: err.message });
    }
  }

  await logSyncOperation(api, {
    connectionId: connection.id,
    shopId: connection.shop.id,
    syncType: "product",
    endpoint: "syncOptimumProducts",
    received: stocks.length,
    accepted,
    errors,
    startedAt,
  });

  logger.info({ received: stocks.length, accepted, errors: errors.length }, "syncOptimumProducts completed");

  return { success: true, received: stocks.length, accepted, errors: errors.length };
};

export const params = {};
