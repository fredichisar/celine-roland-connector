/**
 * Log an ERP sync operation to erpSyncLog.
 */
export async function logSyncOperation(api, { connectionId, shopId, syncType, endpoint, received, accepted, errors, startedAt }) {
  const status = errors.length === 0 ? "success" : (accepted === 0 ? "failed" : "success");

  await api.erpSyncLog.create({
    syncType,
    endpoint,
    status,
    received,
    accepted,
    errors: errors.length > 0 ? errors : null,
    message: errors.length > 0 ? `${errors.length} error(s): ${errors[0]?.message || "unknown"}` : `${accepted}/${received} processed`,
    recordsSynced: accepted,
    startedAt,
    completedAt: new Date(),
    erpConnection: { _link: connectionId },
    shop: { _link: shopId },
  });
}
