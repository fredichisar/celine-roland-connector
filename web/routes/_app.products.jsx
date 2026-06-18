import { useState, useEffect, useRef, useCallback } from "react";
import { useLoaderData, useSubmit, useNavigation, useNavigate, useRevalidator } from "react-router";
import { api } from "../api";

const PAGE_SIZE = 250;

const ARTICLE_TYPE_LABELS = {
  "1": "Verre",
  "3": "Monture",
  "4": "Accessoire",
  "5": "Lentille",
};

const STATUS_BADGES = {
  pending: { tone: "warning", label: "En attente" },
  synced: { tone: "success", label: "Synchronisé" },
  skipped: { tone: "info", label: "Ignoré" },
  error: { tone: "critical", label: "Erreur" },
};

export const loader = async ({ request, context }) => {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "all";
  const afterCursor = url.searchParams.get("after") || undefined;
  const beforeCursor = url.searchParams.get("before") || undefined;

  const filter = {};
  if (statusFilter !== "all") {
    filter.syncStatus = { equals: statusFilter };
  }

  const queryParams = {
    sort: { createdAt: "Descending" },
    filter,
    select: {
      id: true,
      codeArticle: true,
      nomArticle: true,
      modele: true,
      marque: true,
      codeMarque: true,
      codeFabricant: true,
      nomFabricant: true,
      codeEan: true,
      articleTypeId: true,
      lotMouvementId: true,
      quantiteDisponible: true,
      prixAchat: true,
      prixVente: true,
      spec: true,
      syncStatus: true,
      syncError: true,
      lastSyncedAt: true,
      shopifyProduct: { id: true },
    },
  };

  if (beforeCursor) {
    queryParams.last = PAGE_SIZE;
    queryParams.before = beforeCursor;
  } else {
    queryParams.first = PAGE_SIZE;
    if (afterCursor) queryParams.after = afterCursor;
  }

  const products = await context.api.optimumProduct.findMany(queryParams);

  const pagination = products.pagination || {};
  const hasNextPage = pagination.hasNextPage || false;
  const hasPreviousPage = pagination.hasPreviousPage || false;
  const startCursor = pagination.startCursor || null;
  const endCursor = pagination.endCursor || null;

  // Counts via global action (server-side, scoped by shop)
  const counts = await context.api.getProductCounts() || {
    total: 0, pending: 0, synced: 0, skipped: 0, error: 0,
  };

  const serialized = products.map((p) => ({
    ...p,
    lastSyncedAt: p.lastSyncedAt ? new Date(p.lastSyncedAt).toISOString() : null,
    shopifyProductId: p.shopifyProduct?.id || null,
  }));

  return {
    products: serialized,
    counts,
    statusFilter,
    hasNextPage,
    hasPreviousPage,
    startCursor,
    endCursor,
    pageSize: PAGE_SIZE,
  };
};

export const action = async ({ request, context }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "refresh") {
    const enqueuedAt = new Date().toISOString();
    await context.api.enqueue(context.api.syncOptimumProducts);
    return { refreshed: true, enqueuedAt };
  }

  if (intent === "reconcile") {
    const enqueuedAt = new Date().toISOString();
    await context.api.enqueue(context.api.reconcileProducts);
    return { reconciling: true, enqueuedAt };
  }

  if (intent === "sync") {
    const ids = formData.getAll("productIds");
    if (ids.length > 0) {
      await context.api.enqueue(context.api.pushProductToShopify, { productIds: ids });
      return { syncing: true, count: ids.length };
    }
  }

  if (intent === "skip") {
    const ids = formData.getAll("productIds");
    for (const id of ids) {
      await context.api.optimumProduct.update(id, { syncStatus: "skipped" });
    }
    return { skipped: true, count: ids.length };
  }

  if (intent === "unskip") {
    const ids = formData.getAll("productIds");
    for (const id of ids) {
      await context.api.optimumProduct.update(id, { syncStatus: "pending" });
    }
    return { unskipped: true, count: ids.length };
  }

  return {};
};

function DetailRow({ label, value }) {
  return (
    <s-stack direction="inline" gap="small-200" justifyContent="space-between" alignItems="center">
      <s-text tone="subdued">{label} :</s-text>
      <s-text type="strong">{value ?? "—"}</s-text>
    </s-stack>
  );
}

function SectionBlock({ heading, children }) {
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-text type="strong">{heading}</s-text>
        <s-divider />
        {children}
      </s-stack>
    </s-box>
  );
}

function DetailModal({ product }) {
  if (!product) return null;
  const spec = product.spec || {};
  const badge = STATUS_BADGES[product.syncStatus] || STATUS_BADGES.pending;

  return (
    <s-modal id="product-detail-modal" heading={product.nomArticle || product.codeArticle} size="large">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone={badge.tone}>{badge.label}</s-badge>
          {product.shopifyProductId && <s-text tone="subdued">Shopify #{product.shopifyProductId}</s-text>}
          {product.lastSyncedAt && <s-text tone="subdued">Sync : {new Date(product.lastSyncedAt).toLocaleString("fr-FR")}</s-text>}
        </s-stack>
        {product.syncError && <s-text tone="critical">{product.syncError}</s-text>}

        <SectionBlock heading="Identité">
          <DetailRow label="Code article (SKU)" value={product.codeArticle} />
          <DetailRow label="Nom article" value={product.nomArticle} />
          <DetailRow label="Modèle" value={product.modele} />
          <DetailRow label="Code EAN" value={product.codeEan} />
          <DetailRow label="Lot mouvement ID" value={product.lotMouvementId} />
          <DetailRow label="Type" value={ARTICLE_TYPE_LABELS[product.articleTypeId] || product.articleTypeId} />
        </SectionBlock>

        <SectionBlock heading="Marque & Fabricant">
          <DetailRow label="Marque" value={product.marque} />
          <DetailRow label="Code marque" value={product.codeMarque} />
          <DetailRow label="Fabricant" value={product.nomFabricant} />
          <DetailRow label="Code fabricant" value={product.codeFabricant} />
        </SectionBlock>

        <SectionBlock heading="Prix & Stock">
          <DetailRow label="Prix d'achat" value={product.prixAchat != null ? `${product.prixAchat} €` : null} />
          <DetailRow label="Prix de vente" value={product.prixVente != null ? `${product.prixVente} €` : null} />
          <DetailRow label="Quantité disponible" value={product.quantiteDisponible} />
        </SectionBlock>

        {Object.keys(spec).length > 0 && (
          <SectionBlock heading="Spécifications optiques">
            <DetailRow label="Type de monture" value={spec.type_de_monture} />
            <DetailRow label="Style" value={spec.style_de_monture} />
            <DetailRow label="Matière" value={spec.matiere_de_la_monture} />
            <DetailRow label="Genre" value={spec.genre} />
            <DetailRow label="Taille" value={spec.taille} />
            <DetailRow label="Coloris" value={spec.coloris} />
            <DetailRow label="Code coloris" value={spec.code_coloris} />
            <DetailRow label="Longueur branches" value={spec.longueur_des_branches} />
          </SectionBlock>
        )}
      </s-stack>

      <s-button slot="primary-action" commandFor="product-detail-modal">Fermer</s-button>
    </s-modal>
  );
}

export default function Products() {
  const {
    products, counts, statusFilter,
    hasNextPage, hasPreviousPage, startCursor, endCursor, pageSize,
  } = useLoaderData();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [selected, setSelected] = useState(new Set());
  const [banner, setBanner] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);
  const revalidator = useRevalidator();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const isLoading = navigation.state !== "idle";

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(products.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const handleReconcile = () => {
    const formData = new FormData();
    formData.set("intent", "reconcile");
    submit(formData, { method: "post" });
    setBanner({ tone: "info", message: "Réconciliation avec Shopify en cours..." });
    setTimeout(() => {
      revalidator.revalidate();
      setBanner({ tone: "success", message: "Réconciliation terminée." });
      setTimeout(() => setBanner(null), 5000);
    }, 3000);
  };

  const handleRefresh = () => {
    const enqueuedAt = new Date().toISOString();
    setRefreshing(true);
    setBanner({ tone: "info", message: "Rafraîchissement depuis Optimum en cours..." });

    const formData = new FormData();
    formData.set("intent", "refresh");
    submit(formData, { method: "post" });

    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const logs = await api.erpSyncLog.findMany({
          filter: {
            endpoint: { equals: "syncOptimumProducts" },
            startedAt: { greaterThanOrEqual: enqueuedAt },
          },
          sort: { startedAt: "Descending" },
          first: 1,
          select: { id: true, status: true, message: true },
        });
        if (logs.length > 0) {
          const log = logs[0];
          stopPolling();
          setRefreshing(false);
          setBanner({ tone: "success", message: `Rafraîchissement terminé — ${log.message || "OK"}` });
          revalidator.revalidate();
          setTimeout(() => setBanner(null), 5000);
        }
      } catch (err) {
        // ignore polling errors
      }
    }, 2000);
  };

  const handleBulkAction = (intent) => {
    if (selected.size === 0) return;
    const formData = new FormData();
    formData.set("intent", intent);
    for (const id of selected) {
      formData.append("productIds", id);
    }
    submit(formData, { method: "post" });
    setSelected(new Set());
    if (intent === "sync") {
      setBanner({ tone: "success", message: `${selected.size} produit(s) en cours de synchronisation vers Shopify...` });
    } else if (intent === "skip") {
      setBanner({ tone: "info", message: `${selected.size} produit(s) ignoré(s).` });
    } else if (intent === "unskip") {
      setBanner({ tone: "info", message: `${selected.size} produit(s) remis en attente.` });
    }
  };

  const openDetail = (product) => {
    setDetailProduct(product);
    setTimeout(() => {
      shopify.modal.show("product-detail-modal");
    }, 0);
  };

  const buildUrl = (params) => {
    const base = "/products";
    const search = new URLSearchParams();
    if (statusFilter !== "all") search.set("status", statusFilter);
    for (const [k, v] of Object.entries(params)) {
      if (v) search.set(k, v);
    }
    const qs = search.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const handleNextPage = () => {
    navigate(buildUrl({ after: endCursor }));
  };

  const handlePreviousPage = () => {
    navigate(buildUrl({ before: startCursor }));
  };

  const handleStatusFilter = (val) => {
    navigate(val === "all" ? "/products" : `/products?status=${val}`);
  };

  return (
    <s-page heading="Produits Optimum" inlineSize="large">
      {banner && (
        <s-banner tone={banner.tone} dismissible onDismiss={() => setBanner(null)}>
          {banner.message}
        </s-banner>
      )}

      <DetailModal product={detailProduct} />

      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button variant="primary" onClick={handleRefresh} disabled={isLoading || refreshing}>
            {refreshing ? "Rafraîchissement en cours..." : "Rafraîchir depuis Optimum"}
          </s-button>
          <s-button variant="secondary" onClick={handleReconcile} disabled={isLoading || refreshing}>
            Réconcilier avec Shopify
          </s-button>
          {selected.size > 0 && (
            <>
              <s-button variant="secondary" onClick={() => handleBulkAction("sync")}>
                Sync {selected.size} vers Shopify
              </s-button>
              <s-button onClick={() => handleBulkAction("skip")}>
                Ignorer {selected.size}
              </s-button>
              <s-button onClick={() => handleBulkAction("unskip")}>
                Remettre en attente {selected.size}
              </s-button>
              <s-button variant="tertiary" onClick={deselectAll}>
                Tout désélectionner
              </s-button>
            </>
          )}
          {selected.size === 0 && products.length > 0 && (
            <s-button variant="tertiary" onClick={selectAll}>
              Tout sélectionner ({products.length})
            </s-button>
          )}
        </s-stack>
      </s-section>

      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr 1fr" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong">Total</s-text>
              <s-heading>{counts.total}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong" tone="warning">En attente</s-text>
              <s-heading>{counts.pending}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong" tone="success">Synchronisés</s-text>
              <s-heading>{counts.synced}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong" tone="info">Ignorés</s-text>
              <s-heading>{counts.skipped}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong" tone="critical">Erreurs</s-text>
              <s-heading>{counts.error}</s-heading>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section padding="none">
        <s-table
          paginate
          hasPreviousPage={hasPreviousPage}
          hasNextPage={hasNextPage}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          paginationLabel={`${products.length} produits affichés`}
          loading={isLoading}
        >
          <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr">
            <s-select
              label="Statut"
              name="statusFilter"
              value={statusFilter}
              labelAccessibilityVisibility="exclusive"
              onChange={(e) => handleStatusFilter(e.target.value)}
            >
              <s-option value="all">Tous les statuts</s-option>
              <s-option value="pending">En attente</s-option>
              <s-option value="synced">Synchronisés</s-option>
              <s-option value="skipped">Ignorés</s-option>
              <s-option value="error">Erreurs</s-option>
            </s-select>
          </s-grid>

          <s-table-header-row>
            <s-table-header>
              <input
                type="checkbox"
                checked={selected.size === products.length && products.length > 0}
                onChange={() => selected.size === products.length ? deselectAll() : selectAll()}
              />
            </s-table-header>
            <s-table-header listSlot="primary">Article</s-table-header>
            <s-table-header listSlot="labeled">SKU</s-table-header>
            <s-table-header listSlot="labeled">Marque</s-table-header>
            <s-table-header listSlot="labeled">EAN</s-table-header>
            <s-table-header listSlot="labeled">Type</s-table-header>
            <s-table-header listSlot="labeled" format="numeric">Qty</s-table-header>
            <s-table-header listSlot="labeled">Prix</s-table-header>
            <s-table-header listSlot="labeled">Statut</s-table-header>
            <s-table-header listSlot="labeled"></s-table-header>
          </s-table-header-row>
          <s-table-body>
            {products.map((p) => {
              const badge = STATUS_BADGES[p.syncStatus] || STATUS_BADGES.pending;
              return (
                <s-table-row key={p.id}>
                  <s-table-cell>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </s-table-cell>
                  <s-table-cell>{p.nomArticle ? p.nomArticle.substring(0, 50) : "-"}</s-table-cell>
                  <s-table-cell>{p.codeArticle}</s-table-cell>
                  <s-table-cell>{p.marque || "-"}</s-table-cell>
                  <s-table-cell>{p.codeEan || "-"}</s-table-cell>
                  <s-table-cell>{ARTICLE_TYPE_LABELS[p.articleTypeId] || p.articleTypeId}</s-table-cell>
                  <s-table-cell>{p.quantiteDisponible ?? "-"}</s-table-cell>
                  <s-table-cell>{p.prixVente ? `${p.prixVente}€` : "-"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={badge.tone}>{badge.label}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button variant="tertiary" icon="view" onClick={() => openDetail(p)} accessibilityLabel="Voir le détail"></s-button>
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>

        {products.length === 0 && !isLoading && (
          <s-box padding="large">
            <s-text tone="subdued">Aucun produit. Cliquez "Rafraîchir depuis Optimum" pour importer.</s-text>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}
