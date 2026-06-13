/** @type { ActionRun } */
export const run = async ({ api }) => {
  const [pending, synced, skipped, error] = await Promise.all(
    ["pending", "synced", "skipped", "error"].map((status) =>
      api.internal.optimumProduct.findMany({
        filter: { syncStatus: { equals: status } },
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
