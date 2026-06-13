import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "erpConnection" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "mm4wVBydsZam",
  fields: {
    apiKey: {
      type: "string",
      validations: { required: true },
      storageKey: "PuBJ7sIFqKSj",
    },
    erpBaseUrl: {
      type: "url",
      validations: { required: true },
      storageKey: "b0-tq7xIxkIk",
    },
    isActive: {
      type: "boolean",
      validations: { required: true },
      storageKey: "BXGr9PYwxFUR",
    },
    name: {
      type: "string",
      validations: { required: true },
      storageKey: "I67ZVVSpeUrP",
    },
    notificationEmails: { type: "json", storageKey: "rUXmGxuD5Q1Y" },
    shop: {
      type: "belongsTo",
      parent: { model: "shopifyShop" },
      storageKey: "erpConnection-shop",
    },
  },
};
