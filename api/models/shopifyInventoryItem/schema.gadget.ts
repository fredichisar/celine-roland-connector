import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyInventoryItem" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "DataModel-Shopify-InventoryItem",
  fields: {},
  searchIndex: false,
  shopify: {
    fields: {
      cost: { filterIndex: false, searchIndex: false },
      countryCodeOfOrigin: { filterIndex: false, searchIndex: false },
      countryHarmonizedSystemCodes: {
        filterIndex: false,
        searchIndex: false,
      },
      harmonizedSystemCode: {
        filterIndex: false,
        searchIndex: false,
      },
      locations: true,
      productVariant: true,
      productVariants: true,
      provinceCodeOfOrigin: {
        filterIndex: false,
        searchIndex: false,
      },
      requiresShipping: { filterIndex: false, searchIndex: false },
      shop: { searchIndex: false },
      shopifyCreatedAt: { filterIndex: false, searchIndex: false },
      shopifyUpdatedAt: { filterIndex: false, searchIndex: false },
      sku: { searchIndex: false },
      tracked: { searchIndex: false },
      weightUnit: { filterIndex: false, searchIndex: false },
      weightValue: { filterIndex: false, searchIndex: false },
    },
  },
};
