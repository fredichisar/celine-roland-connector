import { createOptimumClient } from "../utils/optimum-client";
import { logSyncOperation } from "../utils/erp-log";

/** @type { ActionRun } */
export const run = async ({ params, logger, api }) => {
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
    // Matching strategy:
    // - Montures: match par SKU Shopify → optimumProduct.codeArticle
    // - Verres personnalisés: match par _optimum_ref (property line item) → optimumProduct.codeArticle
    const lineItems = payload.line_items || [];
    const articlesStock = [];
    const unmatchedItems = [];

    for (const item of lineItems) {
      // Déterminer la clé de matching : _optimum_ref pour les verres, SKU pour les montures
      const matchKey = item.optimum_ref || item.sku;

      if (!matchKey) {
        unmatchedItems.push({ title: item.title, reason: "no SKU and no _optimum_ref" });
        continue;
      }

      const optimumProduct = await api.optimumProduct.maybeFindFirst({
        filter: {
          codeArticle: { equals: matchKey },
          shop: { equals: connection.shop.id },
        },
        select: { id: true, lotMouvementId: true, articleTypeId: true, syncStatus: true },
      });

      if (!optimumProduct) {
        unmatchedItems.push({
          sku: item.sku,
          optimum_ref: item.optimum_ref,
          title: item.title,
          reason: item.optimum_ref
            ? `_optimum_ref "${item.optimum_ref}" not found in optimumProduct`
            : `SKU "${item.sku}" not found in optimumProduct`,
        });
        continue;
      }

      for (let i = 0; i < (item.quantity || 1); i++) {
        articlesStock.push({
          lot_mouvement_id: optimumProduct.lotMouvementId,
          article_type_id: parseInt(optimumProduct.articleTypeId, 10),
          prix_de_vente: parseFloat(item.price) || 0,
        });
      }
    }

    if (articlesStock.length === 0) {
      throw new Error(`No matching products found. Unmatched: ${unmatchedItems.map((i) => i.optimum_ref || i.sku || i.title).join(", ")}`);
    }

    const offreResult = await client.createOffre(optimumClientId, visiteId, {
      type_equipement: 1,
      type_prescription: 1,
      articles_stock: articlesStock,
      options_offre: {
        offre_remboursee: false,
        tiers_payant_ro: false,
        tiers_payant_rc_1: false,
        tiers_payant_rc_2: false,
        teletransmission_ro: false,
        teletransmission_rc_1: false,
      },
    });

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
