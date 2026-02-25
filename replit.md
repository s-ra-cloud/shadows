# SHADOWS - Comparative Archetypal Atlas

## Overview
SHADOWS is an academic research platform for comparative mythology. It visualizes mythological figures (deities, heroes, etc.) using interactive network graphs built with D3.js, positioning figures by attribute similarity across world traditions.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, TailwindCSS, D3.js
- **Backend**: Express.js API routes
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter (client-side), Express (server-side)
- **State**: TanStack React Query

## Architecture
- `client/src/pages/` - Page components (landing, team, partners, news, research, graph, admin)
- `client/src/components/` - Shared components (Navbar, Footer, shadcn/ui)
- `server/` - Express backend (routes.ts, storage.ts, seed.ts)
- `shared/schema.ts` - Drizzle schema + Zod validation types

## Database Schema
- `projects` - Research modules (title, slug, description)
- `nodes` - Mythological figures with attributes:
  - name, tradition, gender, domain, object, animals
  - characterTrait, physicalCharacteristics
  - significantEvent, birthCircumstances, deathCircumstances
- `edges` - Relationships between figures (parent of, married to, sibling of, adversary of, etc.)
- `news` - News articles (title, content, date)
- `publications` - Research publications (title, authors, venue, abstract, doi, pdf_url)
- `users` - Admin users (username, password)

## Graph Visualization
- Nodes colored by tradition (Greek=purple, Norse=blue, Egyptian=gold, Hindu=orange, Shinto=pink, Sumerian=green, Aztec=cyan)
- Node positioning uses attribute similarity (gender, domain, objects, animals, traits, events, birth/death)
- Edges drawn as lines showing explicit relationships
- Tradition is NOT used for similarity calculation (only for coloring)
- Filters: tradition, gender, domain

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
- `/graph` - Interactive D3.js graph visualization (similarity-based layout)
- `/admin` - Password-protected CRUD dashboard

## Admin
- Login uses SESSION_SECRET env variable as password
- CRUD for figures, relationships, projects, news, publications
- Delete confirmation dialogs

## Running
- `npm run dev` starts both Express backend and Vite frontend
