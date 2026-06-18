import { emails } from "gadget-server";

/** @type { ActionRun } */
export const run = async ({ params, logger, api }) => {
  const { erpOrderId } = params;

  if (!erpOrderId) return;

  const erpOrder = await api.erpOrder.findOne(erpOrderId, {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      errorMessage: true,
      formattedPayload: true,
    },
  });

  if (!erpOrder) return;

  const connection = await api.erpConnection.maybeFindFirst({
    filter: { isActive: { equals: true } },
    select: { notificationEmails: true, orderNotificationEmails: true },
  });

  // Emails commandes en priorité, fallback sur emails erreurs
  const recipients = connection?.orderNotificationEmails || connection?.notificationEmails;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    logger.info("No notification emails configured, skipping");
    return;
  }

  const payload = erpOrder.formattedPayload || {};
  const isSuccess = erpOrder.status === "completed";
  const statusLabel = isSuccess ? "POUSSÉE AVEC SUCCÈS" : "ERREUR";
  const statusColor = isSuccess ? "#2e7d32" : "#c62828";
  const statusEmoji = isSuccess ? "✅" : "❌";

  const lineItemsHtml = (payload.line_items || []).map((li) => {
    const ref = li.optimum_ref ? `<br><small>Ref Optimum : ${li.optimum_ref}</small>` : "";
    const lens = li.lens_type ? `<br><small>Type : ${li.lens_type}</small>` : "";
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${li.title || "-"}${ref}${lens}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${li.sku || "-"}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${li.quantity || 1}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${li.price || "-"} ${payload.currency || "EUR"}</td>
    </tr>`;
  }).join("");

  const optimumInfo = isSuccess ? `
    <tr><td style="padding:4px 0;color:#666">Client Optimum :</td><td style="padding:4px 0"><strong>${payload.optimum_client_id || "-"}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#666">Visite :</td><td style="padding:4px 0"><strong>${payload.optimum_visite_id || "-"}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#666">Offre :</td><td style="padding:4px 0"><strong>${payload.optimum_offre_id || "-"}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#666">Proposition :</td><td style="padding:4px 0"><strong>${payload.optimum_proposition_id || "-"}</strong></td></tr>
  ` : "";

  const errorBlock = !isSuccess ? `
    <div style="background:#ffebee;border-left:4px solid #c62828;padding:12px;margin:16px 0;border-radius:4px">
      <strong>Erreur :</strong> ${erpOrder.errorMessage || "Erreur inconnue"}
    </div>
  ` : "";

  const unmatchedBlock = (payload.unmatched_items && payload.unmatched_items.length > 0) ? `
    <div style="background:#fff3e0;border-left:4px solid #e65100;padding:12px;margin:16px 0;border-radius:4px">
      <strong>Articles non matchés :</strong>
      <ul>${payload.unmatched_items.map((i) => `<li>${i.optimum_ref || i.sku || i.title} — ${i.reason}</li>`).join("")}</ul>
    </div>
  ` : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:${statusColor};color:white;padding:16px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">${statusEmoji} Commande optique ${statusLabel}</h2>
      </div>
      <div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#666">Commande :</td><td style="padding:4px 0"><strong>${erpOrder.orderNumber || "-"}</strong></td></tr>
          <tr><td style="padding:4px 0;color:#666">Client :</td><td style="padding:4px 0"><strong>${payload.client_name || payload.email || "-"}</strong></td></tr>
          <tr><td style="padding:4px 0;color:#666">Email :</td><td style="padding:4px 0">${payload.email || "-"}</td></tr>
          <tr><td style="padding:4px 0;color:#666">Montant :</td><td style="padding:4px 0"><strong>${payload.total_price || "-"} ${payload.currency || "EUR"}</strong></td></tr>
          ${optimumInfo}
        </table>

        ${errorBlock}
        ${unmatchedBlock}

        <h3 style="margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:8px">Articles</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left">Article</th>
            <th style="padding:8px 12px;text-align:left">SKU</th>
            <th style="padding:8px 12px;text-align:left">Qty</th>
            <th style="padding:8px 12px;text-align:left">Prix</th>
          </tr>
          ${lineItemsHtml}
        </table>

        <p style="margin-top:20px;color:#999;font-size:12px">
          Connecteur ERP Céline Roland — Rocketify
        </p>
      </div>
    </div>
  `;

  const subject = isSuccess
    ? `${statusEmoji} ${erpOrder.orderNumber} — Commande optique poussée dans Optimum`
    : `${statusEmoji} ${erpOrder.orderNumber} — Erreur push Optimum`;

  await emails.sendMail({
    to: recipients,
    subject,
    html,
  });

  logger.info({ orderNumber: erpOrder.orderNumber, status: erpOrder.status, recipients }, "Order notification sent");
};

export const params = {
  erpOrderId: { type: "string" },
};
