import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";
import { handleOrderForOptimum } from "../../../utils/handle-order";

/** @type { ActionRun } */
export const run = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

/** @type { ActionOnSuccess } */
export const onSuccess = async ({ params, record, logger, api, connections }) => {
  try {
    await handleOrderForOptimum({ record, logger, api });
  } catch (err) {
    logger.error({ orderId: record.id, error: err.message }, "Failed to handle order for Optimum");
  }
};

/** @type { ActionOptions } */
export const options = { actionType: "update" };
