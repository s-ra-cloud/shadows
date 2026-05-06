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
- `trait_hierarchy` - Physical characteristics taxonomy (categoryField, traitName, parentId, isLeaf) — 236 entries organized in a three-level top structure:
  - **human** (appearance, stature, age, bearded, skin color, face, eyes, hair, body state, hybridity)
  - **animal** → mammal (feline, bovine, canine, equine, caprine, cervid, cetacean, chiropteran, lagomorph, primate) / bird / reptile (snake, crocodile, turtle, tortoise) / amphibian / fish / insect
  - **monstrous / chimeric** (dragon)
- `trait_habitat` - Habitat classification for animal metacategories (terrestrial, aquatic, aerial, chthonic) — 33 entries, allows multi-habitat membership
- `trait_cross_cut` - Cross-cutting trait groupings that span across categories (crossCutName, traitHierarchyId, standaloneTrait) — 65 entries in 6 groups:
  - animal-headed (25), animal-bodied (12), multiple-heads (9), winged (8), horned (7), tailed (4)
- `users` - Admin users (username, password)

## Data Source
- 1,208 mythological figures from curated database — ALL 100% ENRICHED across 19 traditions:
  - Greek (364), Chinese (183), Egyptian (152), Roman (148), Shinto (96), Norse (61), Aztec (54), Hindu (33), Celtic (21), Mesopotamian (20), Canaanite (14), Abrahamic (12), Cross-cultural (12), Germanic (9), Buddhist (8), Balinese (8), Gnostic (6), Phrygian (5), Christian (2)
  - All figures have: domain, character_trait, physical_characteristics, symbolism, neumann_archetype
  - 258 with normalized eventTypes, 387 with birthTypes, 60 with deathTypes
  - 450+ relationship edges (parent_of, child_of, sibling_of, married_to, trinity, adversary_of)
  - Data quality: No parenthetical notes, Wikipedia-sourced, no underscores in array entries
- Seed runs automatically on startup if database is empty
- Data file: data/mythology-database.json

## Graph Visualization
- **Canvas-based** rendering for performance with 1000+ nodes
- **Five view modes:**
  - **Network** — Bipartite layout: character nodes + shared trait nodes (including eventTypes, birthTypes, deathTypes)
  - **Direct** — Ego-centric view: pick a focal deity, see only the figures sharing traits with it. Radial 2D layout with concentric rings (closer ring = more shared traits, neighbors sorted by tradition within ring). Uniform node size — ring distance encodes connection strength. Adaptive ring density based on neighbor count; labels shown for top neighbors when crowded, all when sparse. Min-shared-traits slider (1–10) controls how many neighbors appear; click a neighbor to re-center; drag to pan; wheel to zoom.
  - **Similarity Map (UMAP)** — 2D non-linear projection optimized for revealing clusters of similar figures. Builds binary trait vectors per figure (across all enabled categories, including supersets), runs UMAP with Jaccard distance (umap-js package). Adjustable Neighbors slider (5–50, local vs global focus) and Spread slider (0.01–0.50, cluster tightness). Points colored by tradition. Pan/zoom/click/hover. Designed to expose cluster structure that CA cannot when the data is high-dimensional with many unique trait values.
  - **Dichotomy** — Recursive binary splits by exclusive traits using binary space partition layout (treemap-style). Cross-category trait pairs allowed. Coverage floor 10%, scoring: coverage²×10 + balance×0.2. Used traits blocked (not categories) across recursion levels.
  - **Relations** — Dedicated 3D force-directed graph showing only characters connected by relationship edges. Nodes colored by tradition. Edges use semantic color gradient: Kinship (gold gradient: parent=#B8860B, child=#DAA520, sibling=#FFD700), Bond (married=#FF69B4), Spiritual (trinity=#9B59B6), Conflict (adversary=#DC143C). Curved edges for multi-relation pairs. Hover tooltip shows all relationships for a character. Grouped legend in bottom-right.
- Character nodes uniform #E0DCE6, no tradition coloring
- Trait nodes colored by category: gender, domain, object, animals, characterTrait, physicalCharacteristics, eventTypes (#E53935), birthTypes (#00BCD4), deathTypes (#B71C1C), familyRoles (#F48FB1), animalType (#FF8A65), objectType (#FFD700)
- **Superset grouping** — "Group" toggle buttons on Animals and Object categories replace individual trait nodes (e.g. snake, eagle, sword) with superset categories (Mammals, Birds, Reptiles, Weapons, Armor & Protection, etc.). Unmapped items fall into "Other Animals"/"Other Objects". Supersets are defined in ANIMAL_SUPERSETS and OBJECT_SUPERSETS mappings. Works across all four view modes.
- **Character selection** — Search and pick specific characters to display
- **Min. connections slider** (1-10, default 2) — Controls minimum shared traits for trait nodes to appear in network view, and minimum connections for characters to appear in direct view
- **Relationship edges** — Toggle-able color-coded lines showing relationships between mythological figures across all 5 view modes. 6 types grouped by semantic meaning:
  - Kinship (gold gradient): Parent Of (#B8860B), Child Of (#DAA520), Sibling Of (#FFD700)
  - Bond: Married To (#FF69B4)
  - Spiritual: Trinity (#9B59B6) — for triple-deity groupings (e.g. Morrígna)
  - Conflict: Adversary Of (#DC143C)
  Sidebar checkboxes with "Hide all / Show all" toggle. Canvas legend overlay shows active types. Uses refs for lightweight redraws (no simulation reset on toggle).
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
