import type { GadgetPermissions } from "gadget-server";

/**
 * This metadata describes the access control configuration available in your application.
 * Grants that are not defined here are set to false by default.
 *
 * View and edit your roles and permissions in the Gadget editor at https://celine-roland-connector.gadget.app/edit/settings/permissions
 */
export const permissions: GadgetPermissions = {
  type: "gadget/permissions/v1",
  roles: {
    "shopify-app-users": {
      storageKey: "Role-Shopify-App",
      models: {
        erpConnection: {
          read: {
            filter:
              "accessControl/filters/shopify/erpConnection.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        erpOrder: {
          read: {
            filter: "accessControl/filters/shopify/erpOrder.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        erpSyncLog: {
          read: {
            filter: "accessControl/filters/shopify/erpSyncLog.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        optimumProduct: {
          read: {
            filter:
              "accessControl/filters/shopify/optimumProduct.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyGdprRequest: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyGdprRequest.gelly",
          },
          actions: {
            create: true,
            update: true,
          },
        },
        shopifyInventoryItem: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyInventoryItem.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyInventoryLevel: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyInventoryLevel.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyLocation: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyLocation.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyOrder: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyOrder.gelly",
          },
        },
        shopifyOrderLineItem: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyOrderLineItem.gelly",
          },
        },
        shopifyProduct: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProduct.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProductVariant: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductVariant.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyShop: {
          read: {
            filter: "accessControl/filters/shopify/shopifyShop.gelly",
          },
          actions: {
            install: true,
            reinstall: true,
            uninstall: true,
            update: true,
          },
        },
        shopifySync: {
          read: {
            filter: "accessControl/filters/shopify/shopifySync.gelly",
          },
          actions: {
            abort: true,
            complete: true,
            error: true,
            run: true,
          },
        },
      },
      actions: {
        getProductCounts: true,
        pushProductToShopify: true,
        syncOptimumProducts: true,
        testConnection: true,
      },
    },
    unauthenticated: {
      storageKey: "unauthenticated",
    },
  },
};
