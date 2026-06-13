import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "erpOrder" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "KQDyd1FQiAYs",
  fields: {
    acknowledgedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "nbylyJJvJ9Y5",
    },
    erpConnection: {
      type: "belongsTo",
      parent: { model: "erpConnection" },
      storageKey: "erpOrder-erpConnection",
    },
    errorMessage: { type: "string", storageKey: "qF4SEHSR_eLh" },
    formattedPayload: { type: "json", storageKey: "EjzX465tw_fR" },
    orderNumber: { type: "string", storageKey: "loToThqpeN1f" },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "erpOrder-shop",
    },
    shopifyOrderId: { type: "string", storageKey: "ToJs4-fWA4al" },
    status: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["pending", "processing", "completed", "error"],
      validations: { required: true },
      storageKey: "ZRddL3OSn5lC",
    },
  },
};
