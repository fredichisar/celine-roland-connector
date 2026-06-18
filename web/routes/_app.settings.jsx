import { useState, useEffect } from "react";
import { useLoaderData, useSubmit } from "react-router";
import { api } from "../api";

export const loader = async ({ context }) => {
  const connections = await context.api.erpConnection.findMany({
    filter: { isActive: { equals: true } },
    select: {
      id: true,
      name: true,
      notificationEmails: true,
      orderNotificationEmails: true,
    },
    first: 1,
  });

  const shop = await context.api.shopifyShop.maybeFindFirst({
    select: { id: true },
  });

  return { connection: connections[0] || null, shopId: shop?.id || null };
};

export const action = async ({ request, context }) => {
  const formData = await request.formData();
  const connectionId = formData.get("connectionId");
  const intent = formData.get("intent");
  const notificationEmails = parseEmails(formData.get("notificationEmails"));
  const orderNotificationEmails = parseEmails(formData.get("orderNotificationEmails"));

  if (intent === "create") {
    const shop = await context.api.shopifyShop.maybeFindFirst({
      select: { id: true },
    });
    await context.api.erpConnection.create({
      name: "Optimum Live",
      apiKey: process.env.OPTIMUM_API_KEY,
      erpBaseUrl: process.env.OPTIMUM_BASE_URL,
      isActive: true,
      notificationEmails,
      orderNotificationEmails,
      shop: shop ? { _link: shop.id } : undefined,
    });
    return { saved: true };
  }

  if (intent === "update") {
    await context.api.erpConnection.update(connectionId, {
      notificationEmails,
      orderNotificationEmails,
    });
    return { saved: true };
  }

  return { saved: false };
};

function parseEmails(raw) {
  if (!raw) return null;
  const emails = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return emails.length > 0 ? emails : null;
}

function sanitizeEmails(raw) {
  if (!raw) return "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).join(", ");
}

export default function Settings() {
  const { connection } = useLoaderData();
  const submit = useSubmit();
  const [saved, setSaved] = useState(false);

  const errorEmailsValue = Array.isArray(connection?.notificationEmails)
    ? connection.notificationEmails.join(", ")
    : "";

  const orderEmailsValue = Array.isArray(connection?.orderNotificationEmails)
    ? connection.orderNotificationEmails.join(", ")
    : "";

  const [errorEmails, setErrorEmails] = useState(errorEmailsValue);
  const [orderEmails, setOrderEmails] = useState(orderEmailsValue);

  useEffect(() => {
    setErrorEmails(errorEmailsValue);
    setOrderEmails(orderEmailsValue);
  }, [errorEmailsValue, orderEmailsValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Sanitiser localement avant d'envoyer
    const cleanError = sanitizeEmails(errorEmails);
    const cleanOrder = sanitizeEmails(orderEmails);
    setErrorEmails(cleanError);
    setOrderEmails(cleanOrder);

    const formData = new FormData();
    formData.set("notificationEmails", cleanError);
    formData.set("orderNotificationEmails", cleanOrder);
    if (connection) {
      formData.set("connectionId", connection.id);
      formData.set("intent", "update");
    } else {
      formData.set("intent", "create");
    }
    submit(formData, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <s-page heading="Réglages — Connecteur Optimum" inlineSize="base">
      {saved && (
        <s-banner tone="success" dismissible>
          Réglages sauvegardés avec succès.
        </s-banner>
      )}

      <s-section heading="Connexion">
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text type="strong">Statut Optimum :</s-text>
              {connection
                ? <s-badge tone="success">Active</s-badge>
                : <s-badge tone="warning">Non configurée</s-badge>
              }
            </s-stack>
            {!connection && (
              <s-button variant="primary" onClick={(e) => {
                e.preventDefault();
                const formData = new FormData();
                formData.set("intent", "create");
                submit(formData, { method: "post" });
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
              }}>
                Activer la connexion
              </s-button>
            )}
          </s-stack>
        </s-box>
      </s-section>

      <form onSubmit={handleSubmit}>
        <s-section heading="Notifications">
          <s-box padding="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong">Notification des erreurs</s-text>
              <s-text tone="subdued">En cas d'erreur de synchronisation (produits, stocks, commandes).</s-text>
              <s-text-field
                label="Emails (séparés par des virgules)"
                name="notificationEmails"
                placeholder="fred@rocketify.io, mathieu@celine-opticien-lunetier.com"
                value={errorEmails}
                onChange={(e) => setErrorEmails(e.target.value)}
              />

              <s-divider />

              <s-text type="strong">Notification des commandes</s-text>
              <s-text tone="subdued">Pour chaque commande optique poussée vers Optimum (succès et erreurs).</s-text>
              <s-text-field
                label="Emails (séparés par des virgules)"
                name="orderNotificationEmails"
                placeholder="opticiens@celine-opticien-lunetier.com, mathieu@celine-opticien-lunetier.com"
                value={orderEmails}
                onChange={(e) => setOrderEmails(e.target.value)}
              />

              <s-button variant="primary" type="submit" disabled={!connection}>
                Enregistrer
              </s-button>
            </s-stack>
          </s-box>
        </s-section>
      </form>
    </s-page>
  );
}
