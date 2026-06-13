import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyLocation" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "DataModel-Shopify-Location",
  fields: {},
  searchIndex: false,
  shopify: {
    fields: {
      active: { searchIndex: false },
      address1: { filterIndex: false, searchIndex: false },
      address2: { filterIndex: false, searchIndex: false },
      city: { filterIndex: false, searchIndex: false },
      country: { filterIndex: false, searchIndex: false },
      countryCode: { filterIndex: false, searchIndex: false },
      inventoryItems: true,
      legacy: { filterIndex: false, searchIndex: false },
      name: { filterIndex: false, searchIndex: false },
      orders: true,
      phone: { filterIndex: false, searchIndex: false },
      province: { filterIndex: false, searchIndex: false },
      provinceCode: { filterIndex: false, searchIndex: false },
      retailOrders: true,
      shop: { searchIndex: false },
      shopifyCreatedAt: { filterIndex: false, searchIndex: false },
      shopifyUpdatedAt: { filterIndex: false, searchIndex: false },
      zipCode: { filterIndex: false, searchIndex: false },
    },
  },
};
