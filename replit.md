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
  - **Correspondence Analysis** — 2D projection of characters and traits
  - **Dichotomy** — Recursive binary splits by mutually exclusive traits (e.g., male/female → mortal/immortal). Controls: depth (2/4/8/16 groups) and exclusion threshold (80-100%). Algorithm finds highest-coverage, most-balanced exclusive trait pairs at each level.
- Character nodes uniform #E0DCE6, no tradition coloring
- Trait nodes colored by category: gender, domain, object, animals, characterTrait, physicalCharacteristics, eventTypes (#E53935), birthTypes (#00BCD4), deathTypes (#B71C1C), familyRoles (#F48FB1)
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
- `/admin` - Password-protected CRUD dashboard

## Admin
- Login uses SESSION_SECRET env variable as password
- CRUD for figures, relationships, projects, news, publications
- Tabs renamed to "Figures" and "Relationships"

## Running
- `npm run dev` starts both Express backend and Vite frontend
- `npx tsx server/scrape-wikipedia.ts` to re-scrape Wikipedia data
