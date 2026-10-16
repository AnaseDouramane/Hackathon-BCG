# Felix Field

Field monitoring web app for Felix, an agricultural extension officer in Kasungu (Malawi). Demo with fictional data.

- **Product & technical spec:** [`spec.md`](spec.md)
- **Database handoff (Azure PostgreSQL):** [`docs/database.md`](docs/database.md)

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000 — uses data/seed.json, no configuration needed
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server (`DATA_SOURCE=memory` by default) |
| `npm run build` | Production build (same as Vercel) |
| `npm test` | Domain logic and seed tests (Vitest) |
| `npm run lint` · `npm run typecheck` | Quality checks — run before every PR |

## Where things are

| Path | Content | Owner |
|---|---|---|
| `app/` | Pages (Dashboard, `/issues/[category]`, `/fields/[id]`) and API routes (`/api/stats`, `/api/fields`, `/api/fields/:id`) | #1 |
| `components/map`, `components/kpi` | Map, filters, legend, KPI cards | #2 |
| `components/issues`, `components/field` | Lists, field detail, lamp | #3 |
| `lib/` | Contract (Zod), domain rules, data repositories, services | #4 |
| `data/seed.json` | Demo data (20 fields) — content to be validated by #5 | #4 / #5 |

## Demo data notes

- "Now" is fixed at **1 March 2027, 07:00 Malawi time** (`DEMO_NOW`), so urgencies don't change with the day of the demo.
- Field polygons are placed programmatically around Kasungu; redraw them on real farmland with [geojson.io](https://geojson.io) (#5).
- Drone pictures in `public/drone/` are generated sample NDVI images, labelled as such.
- Agronomic content is a plausible first draft and must be validated by an agronomist.
