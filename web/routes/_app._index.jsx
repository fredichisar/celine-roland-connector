import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";

export const loader = async ({ request, context }) => {
  const url = new URL(request.url);
  const today = new Date().toISOString().split("T")[0];
  const dateFrom = url.searchParams.get("from") || today;
  const dateTo = url.searchParams.get("to") || today;

  const dateFromISO = `${dateFrom}T00:00:00Z`;
  const dateToISO = `${dateTo}T23:59:59Z`;

  const logs = await context.api.erpSyncLog.findMany({
    sort: { startedAt: "Descending" },
    filter: {
      startedAt: {
        greaterThanOrEqual: dateFromISO,
        lessThanOrEqual: dateToISO,
      },
    },
    first: 250,
    select: {
      id: true,
      syncType: true,
      endpoint: true,
      status: true,
      received: true,
      accepted: true,
      errors: true,
      message: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const allLogs = logs || [];

  const metrics = {
    total: allLogs.length,
    success: allLogs.filter((l) => l.status === "success").length,
    failed: allLogs.filter((l) => l.status === "failed").length,
    totalReceived: allLogs.reduce((sum, l) => sum + (l.received || 0), 0),
    totalAccepted: allLogs.reduce((sum, l) => sum + (l.accepted || 0), 0),
    byType: {},
  };

  for (const log of allLogs) {
    if (!metrics.byType[log.syncType]) {
      metrics.byType[log.syncType] = { total: 0, success: 0, failed: 0, received: 0, accepted: 0 };
    }
    metrics.byType[log.syncType].total++;
    if (log.status === "success") metrics.byType[log.syncType].success++;
    if (log.status === "failed") metrics.byType[log.syncType].failed++;
    metrics.byType[log.syncType].received += log.received || 0;
    metrics.byType[log.syncType].accepted += log.accepted || 0;
  }

  const serializedLogs = allLogs.map((l) => ({
    ...l,
    startedAt: l.startedAt ? new Date(l.startedAt).toISOString() : null,
    completedAt: l.completedAt ? new Date(l.completedAt).toISOString() : null,
  }));

  const [pendingOrders, completedOrders, errorOrders] = await Promise.all([
    context.api.erpOrder.findMany({ filter: { status: { equals: "pending" } }, first: 250, select: { id: true } }),
    context.api.erpOrder.findMany({ filter: { status: { equals: "completed" } }, first: 250, select: { id: true } }),
    context.api.erpOrder.findMany({ filter: { status: { equals: "error" } }, first: 250, select: { id: true } }),
  ]);

  const orderMetrics = {
    pending: pendingOrders.length,
    completed: completedOrders.length,
    error: errorOrders.length,
    total: pendingOrders.length + completedOrders.length + errorOrders.length,
  };

  const recentOrders = await context.api.erpOrder.findMany({
    sort: { createdAt: "Descending" },
    first: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      errorMessage: true,
      acknowledgedAt: true,
      createdAt: true,
      formattedPayload: true,
    },
  });

  const serializedOrders = recentOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    errorMessage: o.errorMessage,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    email: o.formattedPayload?.email || "-",
    totalPrice: o.formattedPayload?.total_price || "-",
    currency: o.formattedPayload?.currency || "EUR",
    clientName: o.formattedPayload?.client_name || null,
    itemCount: o.formattedPayload?.line_items?.length || 0,
    optimumVisiteId: o.formattedPayload?.optimum_visite_id || null,
  }));

  return { logs: serializedLogs, metrics, orderMetrics, recentOrders: serializedOrders, dateFrom, dateTo };
};

const SYNC_TYPE_LABELS = {
  product: "Produits",
  inventory: "Inventaire",
  stock: "Stocks",
  order: "Commandes",
};

const STATUS_BADGES = {
  success: { tone: "success", label: "Succès" },
  failed: { tone: "critical", label: "Erreur" },
  pending: { tone: "warning", label: "En cours" },
};

function formatDate(isoStr) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function formatDuration(start, end) {
  if (!start || !end) return "-";
  const ms = new Date(end) - new Date(start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function Dashboard() {
  const { logs, metrics, orderMetrics, recentOrders, dateFrom: loaderFrom, dateTo: loaderTo } = useLoaderData();
  const [orderFilter, setOrderFilter] = useState("all");
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const applyDateRange = (from, to) => {
    navigate(`/?from=${from}&to=${to}`);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    if (filterType !== "all" && log.syncType !== filterType) return false;
    return true;
  });

  return (
    <s-page heading="Connecteur Optimum — Céline Roland" inlineSize="large">
      <s-section>
        <s-stack direction="inline" gap="base" alignItems="end">
          <s-date-field
            label="Du"
            name="dateFrom"
            value={loaderFrom}
            onChange={(e) => applyDateRange(e.target.value, loaderTo)}
          />
          <s-date-field
            label="Au"
            name="dateTo"
            value={loaderTo}
            onChange={(e) => applyDateRange(loaderFrom, e.target.value)}
          />
        </s-stack>
      </s-section>

      <s-section heading="Commandes optiques → Optimum">
        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="neutral">Total</s-text>
              <s-heading>{orderMetrics.total}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="warning">En attente</s-text>
              <s-heading>{orderMetrics.pending}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="success">Poussées</s-text>
              <s-heading>{orderMetrics.completed}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="critical">En erreur</s-text>
              <s-heading>{orderMetrics.error}</s-heading>
            </s-stack>
          </s-box>
        </s-grid>

        <s-box padding="base">
          <s-select
            label="Filtre statut"
            name="orderFilter"
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
          >
            <s-option value="all">Toutes</s-option>
            <s-option value="pending">En attente</s-option>
            <s-option value="completed">Poussées</s-option>
            <s-option value="error">En erreur</s-option>
          </s-select>
        </s-box>

        <s-table variant="auto">
          <s-table-header-row>
            <s-table-header listSlot="primary">Commande</s-table-header>
            <s-table-header listSlot="labeled">Date</s-table-header>
            <s-table-header listSlot="labeled">Client</s-table-header>
            <s-table-header listSlot="labeled">Montant</s-table-header>
            <s-table-header listSlot="labeled">Articles</s-table-header>
            <s-table-header listSlot="labeled">Visite Optimum</s-table-header>
            <s-table-header listSlot="labeled">Statut</s-table-header>
            <s-table-header listSlot="labeled">Erreur</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {recentOrders
              .filter((o) => orderFilter === "all" || o.status === orderFilter)
              .map((o) => (
              <s-table-row key={o.id}>
                <s-table-cell>{o.orderNumber}</s-table-cell>
                <s-table-cell>{formatDate(o.createdAt)}</s-table-cell>
                <s-table-cell>{o.clientName || o.email}</s-table-cell>
                <s-table-cell>{o.totalPrice} {o.currency}</s-table-cell>
                <s-table-cell>{o.itemCount}</s-table-cell>
                <s-table-cell>{o.optimumVisiteId || "-"}</s-table-cell>
                <s-table-cell>
                  {o.status === "pending" && <s-badge tone="warning">En attente</s-badge>}
                  {o.status === "completed" && <s-badge tone="success">Poussée</s-badge>}
                  {o.status === "error" && <s-badge tone="critical">Erreur</s-badge>}
                </s-table-cell>
                <s-table-cell>{o.errorMessage || "-"}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="Vue d'ensemble des opérations">
        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="neutral">Total opérations</s-text>
              <s-heading>{metrics.total}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="success">Succès</s-text>
              <s-heading>{metrics.success}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="critical">Erreurs</s-text>
              <s-heading>{metrics.failed}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-text type="strong" tone="neutral">Items traités</s-text>
              <s-heading>{metrics.totalAccepted}/{metrics.totalReceived}</s-heading>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Par type">
        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="base">
          {Object.entries(metrics.byType).map(([type, data]) => (
            <s-box key={type} padding="base" background="subdued" borderRadius="base">
              <s-stack direction="block" gap="base">
                <s-text type="strong">{SYNC_TYPE_LABELS[type] || type}</s-text>
                <s-stack direction="inline" gap="base">
                  <s-badge tone="success">{data.success} ok</s-badge>
                  {data.failed > 0 && <s-badge tone="critical">{data.failed} err</s-badge>}
                </s-stack>
                <s-text tone="subdued">{data.accepted}/{data.received} items</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </s-section>

      <s-section heading="Journal des opérations">
        <s-box padding="base">
          <s-stack direction="inline" gap="base">
            <s-select
              label="Statut"
              name="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <s-option value="all">Tous</s-option>
              <s-option value="success">Succès</s-option>
              <s-option value="failed">Erreur</s-option>
            </s-select>
            <s-select
              label="Type"
              name="filterType"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <s-option value="all">Tous</s-option>
              <s-option value="product">Produits</s-option>
              <s-option value="order">Commandes</s-option>
              <s-option value="stock">Stocks</s-option>
              <s-option value="inventory">Inventaire</s-option>
            </s-select>
          </s-stack>
        </s-box>

        <s-table variant="auto">
          <s-table-header-row>
            <s-table-header listSlot="primary">Date</s-table-header>
            <s-table-header listSlot="labeled">Type</s-table-header>
            <s-table-header listSlot="labeled">Endpoint</s-table-header>
            <s-table-header listSlot="labeled">Statut</s-table-header>
            <s-table-header listSlot="labeled">Items</s-table-header>
            <s-table-header listSlot="labeled">Durée</s-table-header>
            <s-table-header listSlot="labeled">Message</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {filteredLogs.map((log) => {
              const badge = STATUS_BADGES[log.status] || STATUS_BADGES.pending;
              return (
                <s-table-row key={log.id}>
                  <s-table-cell>{formatDate(log.startedAt)}</s-table-cell>
                  <s-table-cell>{SYNC_TYPE_LABELS[log.syncType] || log.syncType}</s-table-cell>
                  <s-table-cell>{log.endpoint}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={badge.tone}>{badge.label}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{log.accepted}/{log.received}</s-table-cell>
                  <s-table-cell>{formatDuration(log.startedAt, log.completedAt)}</s-table-cell>
                  <s-table-cell>{log.message || "-"}</s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}
