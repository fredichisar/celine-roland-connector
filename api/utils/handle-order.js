/**
 * Vérifie si une commande Shopify doit être poussée vers Optimum et l'enqueue si oui.
 * Appelé depuis shopifyOrder create ET update.
 *
 * Conditions :
 * - Tag "commandes optiques" présent
 * - Statut financier "paid"
 * - Pas déjà un erpOrder existant pour cette commande
 */
export async function handleOrderForOptimum({ record, logger, api }) {
  const order = await api.shopifyOrder.findOne(record.id, {
    select: {
      id: true,
      email: true,
      name: true,
      tags: true,
      financialStatus: true,
      totalPrice: true,
      subtotalPrice: true,
      totalTax: true,
      currency: true,
      note: true,
      billingAddress: true,
      shippingAddress: true,
      shop: { id: true },
      lineItems: {
        edges: {
          node: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            price: true,
            title: true,
            variantTitle: true,
            properties: true,
          },
        },
      },
    },
  });

  // --- Filtre tag ---
  const tags = Array.isArray(order.tags) ? order.tags : (order.tags || "").split(",").map((t) => t.trim());
  if (!tags.includes("commandes optiques")) {
    return;
  }

  // --- Filtre statut financier ---
  if (order.financialStatus !== "paid") {
    logger.info({ orderNumber: order.name, financialStatus: order.financialStatus }, "Order skipped — not paid");
    return;
  }

  // --- Dédoublonnage : vérifier si déjà traité ---
  const existingErpOrder = await api.erpOrder.maybeFindFirst({
    filter: { shopifyOrderId: { equals: String(order.id) } },
    select: { id: true, status: true },
  });

  if (existingErpOrder) {
    logger.info({ orderNumber: order.name, erpOrderId: existingErpOrder.id, status: existingErpOrder.status }, "Order already queued, skipping");
    return;
  }

  // --- Formater le payload ---
  const lineItems = (order.lineItems?.edges || []).map((e) => e.node);

  const formattedPayload = {
    shopify_order_id: String(order.id),
    order_number: order.name,
    email: order.email,
    financial_status: order.financialStatus,
    total_price: order.totalPrice,
    subtotal_price: order.subtotalPrice,
    total_tax: order.totalTax,
    currency: order.currency,
    note: order.note,
    tags,
    customer: {
      email: order.email,
      first_name: order.billingAddress?.firstName || order.shippingAddress?.firstName || "",
      last_name: order.billingAddress?.lastName || order.shippingAddress?.lastName || "",
      phone: order.billingAddress?.phone || order.shippingAddress?.phone || "",
    },
    billing_address: order.billingAddress,
    shipping_address: order.shippingAddress,
    line_items: lineItems.map((li) => {
      const props = li.properties || {};
      return {
        id: String(li.id),
        title: li.title,
        variant_title: li.variantTitle,
        sku: li.sku,
        quantity: li.quantity,
        price: li.price,
        name: li.name,
        // Clé Optimum : _code_article (property line item, posée par Thibault) ou _optimum_ref (legacy)
        code_article: props._code_article || null,
        optimum_ref: props._optimum_ref || null,
        lens_type: props._lens_type || null,
        lens_options: props._lens_options || null,
        lens_prescription: props._lens_prescription || null,
        lens_prescription_url: props._lens_prescription_url || null,
      };
    }),
    client_name: [
      order.billingAddress?.firstName || order.shippingAddress?.firstName,
      order.billingAddress?.lastName || order.shippingAddress?.lastName,
    ].filter(Boolean).join(" ") || order.email,
  };

  // --- Créer l'erpOrder et enqueue ---
  const connection = await api.erpConnection.maybeFindFirst({
    filter: { isActive: { equals: true } },
    select: { id: true },
  });

  const erpOrder = await api.erpOrder.create({
    shopifyOrderId: String(order.id),
    orderNumber: order.name,
    status: "pending",
    formattedPayload,
    shop: { _link: order.shop.id },
    erpConnection: connection ? { _link: connection.id } : undefined,
  });

  await api.enqueue(api.pushOrderToOptimum, { erpOrderId: erpOrder.id });

  logger.info({ orderNumber: order.name, erpOrderId: erpOrder.id }, "Optical order queued for Optimum push");
}
