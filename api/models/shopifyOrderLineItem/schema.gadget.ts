import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "shopifyOrderLineItem" model, go to https://celine-roland-connector.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v2",
  storageKey: "DataModel-Shopify-OrderLineItem",
  fields: {},
  searchIndex: false,
  shopify: {
    fields: {
      attributedStaffs: { filterIndex: false, searchIndex: false },
      currentQuantity: { searchIndex: false },
      discountAllocations: { filterIndex: false, searchIndex: false },
      fulfillableQuantity: { filterIndex: false, searchIndex: false },
      giftCard: { filterIndex: false, searchIndex: false },
      grams: { filterIndex: false, searchIndex: false },
      name: { filterIndex: false, searchIndex: false },
      order: { searchIndex: false },
      price: { filterIndex: false, searchIndex: false },
      priceSet: { filterIndex: false, searchIndex: false },
      product: { searchIndex: false },
      productExists: { filterIndex: false, searchIndex: false },
      properties: { filterIndex: false, searchIndex: false },
      quantity: { filterIndex: false, searchIndex: false },
      requiresShipping: { filterIndex: false, searchIndex: false },
      shop: { searchIndex: false },
      sku: { filterIndex: false, searchIndex: false },
      taxLines: { filterIndex: false, searchIndex: false },
      taxable: { filterIndex: false, searchIndex: false },
      title: { filterIndex: false, searchIndex: false },
      totalDiscount: { filterIndex: false, searchIndex: false },
      totalDiscountSet: { filterIndex: false, searchIndex: false },
      variant: { searchIndex: false },
      variantInventoryManagement: {
        filterIndex: false,
        searchIndex: false,
      },
      variantTitle: { filterIndex: false, searchIndex: false },
      vendor: { filterIndex: false, searchIndex: false },
    },
  },
};
