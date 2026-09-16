# SHADOWS — Comparative Archetypal Atlas

SHADOWS is an academic research platform for comparative mythology. It holds a curated database of roughly 1,400 mythological figures across 19 traditions (Greek, Chinese, Roman, Egyptian, Shinto, Norse, Aztec, Hindu, Mesopotamian, and more) and lets researchers explore them through interactive network graphs, similarity maps, and relationship views.

The project is developed by Laura Duparc (University Mohammed VI Polytechnic), Camille Bertrand (EHESS), and Ami Nagai (Aix-Marseille Université).

## Features

- **Interactive graph explorer** (`/graph`) — canvas-rendered D3 visualizations of figures linked by shared traits (domain, animals, objects, character and physical traits, event/birth/death types). View modes: Network (bipartite), Direct (ego-centric starburst), Similarity Map (UMAP), Relations (3D force graph of kinship, marriage, trinity, and adversary edges), and an admin-only Dichotomy view.
- **Browsable database** (`/database`) — figures, relationships, sources with per-field citations, and a public suggestion workflow for proposing edits. Editing is password-protected.
- **Source Hunter** — a corpus-building pipeline that gathers, verifies, and extracts primary-source texts, with an editor-controlled **Daily Hunter** routine (`/daily-hunter`) and a token-authenticated **Hunter Bot API** for trusted autonomous agents. See [docs/daily-hunter.md](docs/daily-hunter.md) and [docs/hunter-bot-api.md](docs/hunter-bot-api.md).
- **Admin dashboard** (`/admin`) — CRUD for figures, relationships, projects, news, and publications.
- **Public site** — landing, team, partners, news, and research publication pages.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, D3.js, umap-js, TanStack Query, Wouter |
| Backend | Node.js, Express 5, TypeScript (run with `tsx`) |
| Database | PostgreSQL, Drizzle ORM |
| Tests | Vitest |
| Hosting | Originally built and deployed on Replit (see `.replit`) |

## Repository layout

```
client/            React frontend (pages in client/src/pages, shared UI in client/src/components)
server/            Express API, storage layer, seeding, Wikipedia scraper, Source Hunter, Daily Hunter
server/__tests__/  Vitest suites
shared/            Drizzle schema and Zod validation types shared by client and server
data/              mythology-database.json seed data and the hunter-corpus (one large file is in Git LFS)
scripts/           One-off data cleanup and migration scripts (numbered by étape)
docs/              Daily Hunter and Hunter Bot API documentation
attached_assets/   Reference screenshots and assets
replit.md          Detailed project notes: schema, graph algorithms, design system, data provenance
```

## Getting started

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 16 (any reachable instance)
- [Git LFS](https://git-lfs.com) installed before cloning, so the large corpus file is fetched

### Install

```bash
git clone https://github.com/s-ra-cloud/shadows.git
cd shadows
npm install
```

### Configure

Create a `.env` file (or export the variables) with at least:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | Session secret; also the admin login password |
| `DB_EDITOR_PASSWORD` | recommended | Password for edit mode on `/database` (a default exists but should be overridden) |
| `PORT` | no | HTTP port, defaults to `5000` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` | for Source Hunter | OpenAI-compatible endpoint used for AI verdicts |
| `HUNTER_AI_MODEL` | no | Model name override for Source Hunter |
| `HUNTER_BOT_API_TOKEN` | for bot API | Bearer token for `/api/bot/hunter` |
| `DAILY_HUNTER_TRIGGER_TOKEN` | for Daily Hunter | Token used by the scheduled worker to trigger runs |
| `DAILY_HUNTER_APP_URL` | for Daily Hunter | Base URL the worker calls |
| `DAILY_HUNTER_PROJECT_PROTECTION_TOKEN` | optional | Extra protection header for the worker |

Then create the schema:

```bash
npm run db:push
```

### Run

```bash
npm run dev
```

This starts the Express API and the Vite dev server together on `http://localhost:5000`. On first start, if the database is empty, it is seeded automatically from `data/mythology-database.json`.

### Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Run the Vitest suites in `server/__tests__` |
| `npm run check` | Type-check with `tsc` |
| `npm run build` | Build the production bundle into `dist/` |
| `npm start` | Serve the production build |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run daily-hunter:worker` | Run the Daily Hunter scheduled worker locally |
| `npm run check:wikisource-api` | Verify Wikisource API compatibility |
| `npx tsx server/scrape-wikipedia.ts` | Re-scrape Wikipedia to repopulate figures |

## Data

Figures carry structured attributes (tradition, gender, domain, objects, animals, character and physical traits, normalized event/birth/death types, family roles, Neumann archetype) plus per-field source attributions. Relationships between figures are stored as typed edges (parent of, child of, sibling of, married to, trinity, adversary of, identified with). A trait hierarchy and cross-cutting groupings (animal-headed, winged, horned, and so on) support the grouped views in the graph.

Original phrasing from before editorial cleanups is preserved in an `original_descriptions` column, and the numbered scripts in `scripts/` document each cleanup pass. See `replit.md` for the full schema and data-quality history.

## Contributing

Work happens on `main`. Please open a branch for non-trivial changes and run `npm test` and `npm run check` before pushing.

Note for macOS contributors: some asset filenames were committed with decomposed Unicode accents. If a fresh clone shows dozens of untracked screenshots, run:

```bash
git config core.precomposeunicode false
```

## License

MIT
