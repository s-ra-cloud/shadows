# SHADOWS - Comparative Archetypal Atlas

## Overview
SHADOWS is an academic research platform for comparative mythology. It visualizes mythological figures (deities, heroes, etc.) using interactive network graphs built with D3.js, using a bipartite layout where figures connect through shared characteristic nodes.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, TailwindCSS, D3.js (Canvas rendering)
- **Backend**: Express.js API routes
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter (client-side), Express (server-side)
- **State**: TanStack React Query

## Architecture
- `client/src/pages/` - Page components (landing, team, partners, news, research, graph, admin)
- `client/src/components/` - Shared components (Navbar, Footer, shadcn/ui)
- `server/` - Express backend (routes.ts, storage.ts, seed.ts)
- `server/scrape-wikipedia.ts` - Wikipedia scraper for populating figures from categories
- `shared/schema.ts` - Drizzle schema + Zod validation types

## Database Schema
- `projects` - Research modules (title, slug, description)
- `nodes` - Mythological figures with attributes:
  - name, tradition, gender, domain, object, animals
  - characterTrait, physicalCharacteristics
  - significantEvent, symbolism, neumannArchetype, mentionCount
  - eventTypes (text array) - 23 types: rescue, sacrifice, descent_to_underworld, quest, etc.
  - birthTypes (text array) - 10 types: divine_parentage, born_from_body, miraculous_conception, etc.
  - deathTypes (text array) - 13 types: dismemberment, killed_by_kin, resurrection, etc.
  - familyRoles (text array) - 4 types: mother, father, sister, brother (409 figures)
  - birthCircumstances, deathCircumstances
- `edges` - Relationships between figures (parent of, married to, sibling of, etc.) - 401 edges
- `news` - News articles (title, content, date)
- `publications` - Research publications (title, authors, venue, abstract, doi, pdf_url)
- `suggestions` - Public suggestions for edits (type, status, submitterName, source, nodeId, field, currentValue, suggestedValue, sourceNodeId, targetNodeId, relationType, edgeId, createdAt)
- `sources` - Reference sources (title, author, url, description, createdAt)
- `users` - Admin users (username, password)

## Data Source
- 1,131 mythological figures from curated database (JSON seed file)
  - 258 with normalized eventTypes, 387 with birthTypes, 60 with deathTypes
  - 83 with symbolism and archetype analysis
  - 401 relationship edges (married_to, child_of, sibling_of, etc.)
- Seed runs automatically on startup if database is empty
- Data file: data/mythology-database.json

## Graph Visualization
- **Canvas-based** rendering for performance with 1000+ nodes
- **Four view modes:**
  - **Network** — Bipartite layout: character nodes + shared trait nodes (including eventTypes, birthTypes, deathTypes)
  - **Direct** — Characters only, connected by number of shared traits (line thickness = common traits count)
  - **Correspondence Analysis** — Interactive 3D scatter plot: D1/D2/D3 map to X/Y/Z spatial axes, D4 maps to color gradient (purple→green→white→yellow→red). Mouse drag to rotate, scroll to zoom. Perspective projection with depth-based sizing. Dimension labels computed from top-loading traits. Bottom-right panel shows all 4 dimensions with inertia % and trait poles + color bar.
  - **Dichotomy** — Recursive binary splits by exclusive traits using binary space partition layout (treemap-style). Cross-category trait pairs allowed. Coverage floor 10%, scoring: coverage²×10 + balance×0.2. Used traits blocked (not categories) across recursion levels.
- Character nodes uniform #E0DCE6, no tradition coloring
- Trait nodes colored by category: gender, domain, object, animals, characterTrait, physicalCharacteristics, eventTypes (#E53935), birthTypes (#00BCD4), deathTypes (#B71C1C), familyRoles (#F48FB1), animalType (#FF8A65), objectType (#FFD700)
- **Superset grouping** — "Group" toggle buttons on Animals and Object categories replace individual trait nodes (e.g. snake, eagle, sword) with superset categories (Mammals, Birds, Reptiles, Weapons, Armor & Protection, etc.). Unmapped items fall into "Other Animals"/"Other Objects". Supersets are defined in ANIMAL_SUPERSETS and OBJECT_SUPERSETS mappings. Works across all four view modes.
- **Character selection** — Search and pick specific characters to display
- **Min. connections slider** (1-10, default 2) — Controls minimum shared traits for trait nodes to appear in network view, and minimum connections for characters to appear in direct view
- Hover highlights connections, click opens detail panel
- Zoom/pan with mouse, labels appear at zoom > 0.6x
- Filters: attribute category checkboxes, search, character picker
- **Persistent selection** — Selected nodes stay highlighted (gold ring) across filter/search changes
- **Adaptive layout** — Force simulation uses degree-based link strength, compact initial spread, and adaptive node sizing for large graphs (1000+ nodes form compact organic clusters centered in viewport)

## Design System
- Dark cosmic theme: backgrounds #0B0626, #0C0042
- Accent: #350A8C, #8F00FF (violet)
- Highlight: #03FF9B (green glow)
- Text: #E0DCE6
- Serif headings (Playfair Display), sans body (DM Sans)

## Team
- Laura Duparc (Lead Researcher, University Mohammed VI Polytechnic)
- Camille Bertrand (Researcher, EHESS)
- Ami Nagai (Researcher, Aix-Marseille Université)

## Pages
- `/` - Landing page with hero, about, graph preview CTA, team, partners sections
- `/team` - Research team profiles
- `/partners` - Collaborating institutions
- `/news` - Academic blog/news articles
- `/research` - Publications list
- `/graph` - Interactive D3.js canvas graph (bipartite layout)
- `/database` - Browsable/editable mythology database with Characters, Relations, Suggestions, Sources tabs. Public users can suggest edits (requires name, suggestion, source). Edit mode is password-protected (DB_EDITOR_PASSWORD env var or default).
- `/admin` - Password-protected CRUD dashboard

## Admin
- Login uses SESSION_SECRET env variable as password
- CRUD for figures, relationships, projects, news, publications
- Tabs renamed to "Figures" and "Relationships"

## Running
- `npm run dev` starts both Express backend and Vite frontend
- `npx tsx server/scrape-wikipedia.ts` to re-scrape Wikipedia data
