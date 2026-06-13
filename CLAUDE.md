# Céline Roland — Connecteur ERP Optimum ↔ Shopify

## Stack
- **Backend**: Gadget.dev (v1.7.0) with Shopify plugin (API 2026-04)
- **Frontend**: React 19 + React Router 7 + Shopify Polaris
- **Client**: `@gadget-client/celine-roland-connector` (auto-generated)
- **ERP**: Optimum Live (REST API, auth via `X-API-KEY` header)

## Architecture
- `api/models/` — Data models (erpConnection, erpOrder, erpSyncLog + Shopify models)
- `api/actions/` — Global actions (testConnection, pushOrder, syncProducts, syncStocks)
- `api/utils/` — Shared utilities (optimum-client, erp-log)
- `api/routes/` — HTTP routes (ping only — prefer global actions)
- `web/routes/` — Frontend pages (settings, dashboard)
- `accessControl/` — Permissions with shop-scoped filters

## Development Rules

1. **Use `ggt add`** for creating models, actions, fields, routes
2. **Prefer global actions** over routes. Routes only for external inbound calls.
3. **Run `ggt problems`** before pushing to check for errors
4. **Never edit `.gadget/`** — auto-generated
5. **Use `gadget-server` imports** for server-side utilities
6. **Use `@gadgetinc/react`** hooks for data fetching in React

## Optimum API

- **Base URL**: configured in erpConnection.erpBaseUrl
- **Auth**: header `X-API-KEY` from erpConnection.apiKey
- **Client**: use `createOptimumClient(connection)` from `api/utils/optimum-client.js`

### Key endpoints
- `POST /api/clients` — Create client
- `GET /api/clients/?last_date=timestamp` — Incremental client sync
- `POST /api/clients/{id}/visites/` — Create visite (prescription à 0)
- `POST /api/clients/{id}/visites/{visite_id}/offres` — Add offre (monture + verres)
- `POST /api/clients/{id}/visites/{visite_id}/ordo_scor` — Upload ordonnance (base64, ≤250Ko)
- `POST /api/stocks/` — Get stock state
- `GET /api/referentiel/marques` — Brands referentiel

### Business rules
- Commandes web → reste en **Proposition** (pas devis — correction optique manquante)
- Prescription créée avec corrections à **0** (l'équipe magasin complète ensuite)
- **Pas de modification/suppression** via l'API — écriture unique
- **Commandes optiques uniquement** poussées vers Optimum
- Ordonnance SCOR : JPEG/JPG/PDF, max 250 Ko

## Shopify Scopes
`read_orders, read_products, read_inventory, read_locations`

## Commands
- `ggt problems` — Check for errors
- `ggt push` — Push local changes to Gadget
- `ggt dev` — Sync files and stream logs
- `yarn shopify:dev` — Run app in development
