import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "erpSyncLog" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "7Ir3OJbzAT7k",
  fields: {
    accepted: { type: "number", storageKey: "ldNqTF9__F1I" },
    completedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "PxSqjUvCWAVL",
    },
    endpoint: { type: "string", storageKey: "c9wRF1LMNTD7" },
    erpConnection: {
      type: "belongsTo",
      parent: { model: "erpConnection" },
      storageKey: "erpSyncLog-erpConnection",
    },
    errors: { type: "json", storageKey: "TOH5UPu7VPNU" },
    message: { type: "string", storageKey: "7lrCmENgloPC" },
    received: { type: "number", storageKey: "3hOOG3BrOgM0" },
    recordsSynced: { type: "number", storageKey: "khDrxC14crT5" },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "erpSyncLog-shop",
    },
    startedAt: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "HgBc0mcN6ZnL",
    },
    status: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["pending", "success", "failed"],
      validations: { required: true },
      storageKey: "LJJN-QUTk18t",
    },
    syncType: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["order", "inventory", "product", "stock"],
      validations: { required: true },
      storageKey: "UJ2zLFfvomL3",
    },
  },
};
