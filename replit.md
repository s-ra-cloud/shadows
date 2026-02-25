# SHADOWS - Comparative Archetypal Atlas

## Overview
SHADOWS is an academic research platform for comparative mythology inspired by Jungian psychology. It visualizes archetypes, deities, mythological figures, and symbolic motifs using interactive network graphs built with D3.js.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, TailwindCSS, D3.js
- **Backend**: Express.js API routes
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter (client-side), Express (server-side)
- **State**: TanStack React Query

## Architecture
- `client/src/pages/` - Page components (landing, team, partners, news, research, projects, graph, admin)
- `client/src/components/` - Shared components (Navbar, Footer, shadcn/ui)
- `server/` - Express backend (routes.ts, storage.ts, seed.ts)
- `shared/schema.ts` - Drizzle schema + Zod validation types

## Database Schema
- `projects` - Research modules (title, slug, description)
- `nodes` - Graph nodes (name, type, culture, period, tradition, domain, description, sources, bibliography)
- `edges` - Graph edges (source_node_id, target_node_id, relation_type, weight)
- `news` - News articles (title, content, date)
- `publications` - Research publications (title, authors, venue, abstract, doi, pdf_url)
- `users` - Admin users (username, password)

## Design System
- Dark cosmic theme: backgrounds #0B0626, #0C0042
- Accent: #350A8C, #8F00FF (violet)
- Highlight: #03FF9B (green glow)
- Text: #E0DCE6
- Serif headings (Playfair Display), sans body (DM Sans)

## Pages
- `/` - Landing page with hero (hero image), about, modules, team, partners sections
- `/team` - Research team profiles
- `/partners` - Collaborating institutions
- `/news` - Academic blog/news articles
- `/research` - Publications list
- `/projects` - Research module overview
- `/projects/:slug` - Interactive D3.js graph visualization
- `/admin` - Password-protected CRUD dashboard

## Admin
- Login uses SESSION_SECRET env variable as password
- CRUD for projects, nodes, edges, news, publications
- Delete confirmation dialogs

## Running
- `npm run dev` starts both Express backend and Vite frontend
- `npm run db:push` pushes schema to PostgreSQL
- Database auto-seeds on first run
