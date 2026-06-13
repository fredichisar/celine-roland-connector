import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "optimumProduct" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "zmRgypNPWQqc",
  fields: {
    articleTypeId: { type: "string", storageKey: "R2W_t1tH4RbU" },
    codeArticle: {
      type: "string",
      validations: { required: true, unique: true },
      storageKey: "a3NLcrhQZnKL",
    },
    codeEan: { type: "string", storageKey: "nTMaacid3I6O" },
    codeFabricant: { type: "string", storageKey: "QMBZOq0s_9Qb" },
    codeMarque: { type: "string", storageKey: "s0vqawwZ49N9" },
    erpConnection: {
      type: "belongsTo",
      parent: { model: "erpConnection" },
      storageKey: "optimumProduct-erpConnection",
    },
    lastSyncedAt: {
      type: "dateTime",
      includeTime: true,
      storageKey: "-1HyJ6siJWLS",
    },
    lotMouvementId: { type: "number", storageKey: "Hfb8lRSPWvk5" },
    marque: { type: "string", storageKey: "HR_5UXzamG8u" },
    modele: { type: "string", storageKey: "HGilCYOEICbY" },
    nomArticle: { type: "string", storageKey: "kkwndgGw8yYu" },
    nomFabricant: { type: "string", storageKey: "LlF18kkQHqBU" },
    prixAchat: { type: "number", storageKey: "H9zNhCxefsR2" },
    prixVente: { type: "number", storageKey: "HDtPtcUnuc-i" },
    quantiteDisponible: {
      type: "number",
      storageKey: "nGv8vMCP4zxK",
    },
    rawData: { type: "json", storageKey: "JiIiuRW11NUt" },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "optimumProduct-shop",
    },
    shopifyProduct: {
      type: "belongsTo",
      parent: { model: "shopifyProduct" },
      storageKey: "optimumProduct-shopifyProduct",
    },
    spec: { type: "json", storageKey: "pMNBEjNuwTf6" },
    syncError: { type: "string", storageKey: "xxi2WDHmj4nQ" },
    syncStatus: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["pending", "synced", "skipped", "error"],
      validations: { required: true },
      storageKey: "_hOzx-UaR2-D",
    },
  },
};
