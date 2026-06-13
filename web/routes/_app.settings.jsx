import { useState } from "react";
import { useLoaderData, useSubmit } from "react-router";
import { api } from "../api";

export const loader = async ({ context }) => {
  const connections = await context.api.erpConnection.findMany({
    filter: { isActive: { equals: true } },
    select: {
      id: true,
      name: true,
      notificationEmails: true,
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
      shop: shop ? { _link: shop.id } : undefined,
    });
    return { saved: true };
  }

  if (intent === "update") {
    await context.api.erpConnection.update(connectionId, { notificationEmails });
    return { saved: true };
  }

  return { saved: false };
};

function parseEmails(raw) {
  if (!raw) return null;
  const emails = raw.split(",").map((e) => e.trim()).filter(Boolean);
  return emails.length > 0 ? emails : null;
}

export default function Settings() {
  const { connection } = useLoaderData();
  const submit = useSubmit();
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
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

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    }
    setTesting(false);
  };

  const emailsDefault = Array.isArray(connection?.notificationEmails)
    ? connection.notificationEmails.join(", ")
    : "";

  return (
    <s-page heading="Réglages — Connecteur Optimum" inlineSize="base">
      {saved && (
        <s-banner tone="success" dismissible>
          Réglages sauvegardés avec succès.
        </s-banner>
      )}

      {testResult && (
        <s-banner tone={testResult.success ? "success" : "critical"} dismissible>
          {testResult.message}
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
              <s-text-field
                label="Emails de notification (séparés par des virgules)"
                name="notificationEmails"
                placeholder="fred@rocketify.io, mathieu@celine-opticien-lunetier.com"
                defaultValue={emailsDefault}
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
