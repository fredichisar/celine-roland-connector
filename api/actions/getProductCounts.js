/** @type { ActionRun } */
export const run = async ({ api }) => {
  const connection = await api.erpConnection.maybeFindFirst({
    filter: { isActive: { equals: true } },
    select: { shop: { id: true } },
  });

  const shopId = connection?.shop?.id;
  if (!shopId) {
    return { pending: 0, synced: 0, skipped: 0, error: 0, total: 0 };
  }

  const [pending, synced, skipped, error] = await Promise.all(
    ["pending", "synced", "skipped", "error"].map((status) =>
      api.internal.optimumProduct.findMany({
        filter: {
          syncStatus: { equals: status },
          shopId: { equals: shopId },
        },
        select: { id: true },
      })
    )
  );

  return {
    pending: pending.length,
    synced: synced.length,
    skipped: skipped.length,
    error: error.length,
    total: pending.length + synced.length + skipped.length + error.length,
  };
};

export const params = {};
