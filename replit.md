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
- Bipartite layout: character nodes + shared trait nodes
- Character nodes colored by tradition (Greek=#8F00FF, Norse=#4A7BFF, Egyptian=#FFB800, Hindu=#FF6B35, Shinto=#FF4081, Sumerian=#03FF9B, Aztec=#00BCD4, Celtic=#7FFF00, Roman=#FF8A65, Mythological=#B388FF)
- Trait nodes colored by attribute category (gender, domain, object, animals, etc.)
- Only traits shared by 3+ figures appear as nodes
- Hover highlights connections, click opens detail panel
- Zoom/pan with mouse, labels appear at zoom > 0.6x
- Filters: tradition checkboxes, attribute category checkboxes, search

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
