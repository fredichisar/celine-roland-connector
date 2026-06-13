import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyInventoryLevel" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "DataModel-Shopify-InventoryLevel",
  fields: {},
  searchIndex: false,
  shopify: {
    fields: {
      adminGraphqlApiId: { searchIndex: false },
      available: { searchIndex: false },
      inventoryItem: { searchIndex: false },
      location: { searchIndex: false },
      shop: { searchIndex: false },
      shopifyUpdatedAt: { filterIndex: false, searchIndex: false },
    },
  },
};
