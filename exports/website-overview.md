# SHADOWS — Website Overview

*A Comparative Archetypal Atlas of Myth and Symbol.*
This document describes every page of the website and what visitors and editors can do on each. Last updated: 8 August 2026.

---

## Public pages

### Home (`/`)
The landing page. A hero section (with a looping background video) introduces the project: mapping deities, figures and motifs across religions and cultures. Scrolling reveals an overview of the project, a preview of the graph/atlas with a link to explore it, a preview of the research team, and partner cards. Purely informational.

### The Project (`/about`)
Explains the mission and method: contextualized comparison of mythologies, the graph-based knowledge environment, the attributes tracked for each entity (origins, domains, iconography, roles, relationships, symbols, events), and the disciplines involved (comparative mythology, philology, religious history, digital humanities). Informational only.

### Research Team (`/team`)
Profile cards for the researchers — Laura Duparc (Lead Researcher, UM6P), Camille Bertrand (EHESS), Ami Nagai (Aix-Marseille) — with photos, bios, and links to LinkedIn/ORCID profiles.

### Partners (`/partners`)
Cards for the partner institutions (LEGACY, Machina Research Network, TELEMMe — UMR 7303, IRIS — EHESS) with logos, descriptions, focus areas and links to their websites.

### News & Updates (`/news`)
Dated article cards with project news. Long articles collapse with a "Read more" toggle. Content is managed from the Admin dashboard.

### Research & Publications (`/research`)
The list of publications: title, authors, venue, abstract (expandable), and links to the DOI and PDF where available. Content is managed from the Admin dashboard.

---

## The Atlas

### Graph (`/graph`)
The interactive heart of the site — a full-screen network of mythological figures and their relationships (opens without the normal site header).

- **Search** — type a figure's name to highlight it and zoom to it.
- **Filters** — by tradition, relationship type, and many trait categories (hierarchy, animals, objects…), with colour legends.
- **Detail views** — click a figure or a connection to see its details; explore a figure's direct neighbourhood ("ego" view).
- **Comparative views** — alternate visualizations for cross-tradition patterns and concepts.
- **World map** — a geographic view of the material.
- **AI analysis** — AI-assisted comparative pattern and concept summaries, generated from the graph data.

Read-only for everyone; no editing happens here.

### Database (`/database`)
The tabular view of the data — currently about 1,131 figures and 401 relationships.

**For all visitors:**
- **Figures** tab — search, filter by tradition, sort; each figure shows its traits and relationships.
- **Relations** tab — search, sort and filter the connections.
- **Cross-cultural** tab — cross-tradition comparisons.
- **Suggestions** tab — anyone can submit a correction or addition (name, suggestion, source/reference).
- **Sources** tab — see below (this is the Library and Source Hunter).
- **Open data** — the database can be downloaded as JSON.

**For editors (after entering the editor password):**
- Edit or delete figures and relations directly.
- Approve, reject or delete visitor suggestions; export/import them.
- Export the full database; import JSON (with confirmation before replacing anything).
- A **Dichotomy** tab (editor-only analysis view).

---

## Sources — the Library & the Source Hunter

Found inside the Database page. Two main tabs:

### Library
The reading room: the collected mythological and religious texts, readable by anyone once their rights are cleared.

### Source Hunter
The machinery that finds and downloads texts, with full respect for each website's rules (robots.txt, source policies, rate limits) and a rights review before anything becomes public. Its sub-tabs:

| Tab | What it does |
|---|---|
| **World Map** | Hunting activity by mythological region; editors can launch a targeted search from any region. |
| **Hunting Cycles** | Launch automated searches; upload a corpus list (CSV/JSON/TXT) to hunt a whole reading list at once; past cycles expand into full reports (what was found, what was blocked and why, with fix hints). If a preferred edition is blocked, the hunter automatically tries the next-best edition. |
| **Candidates** | The shortlist of editions being tracked — title, author, language, rights claim. Editors can add, edit, remove. |
| **Download Plan** | The automated rights-and-suitability assessment: what will be downloaded, what is skipped, and why. |
| **Corpus** | Every downloaded raw file — public (rights-cleared) or locked (under review) — with provenance and extraction status. Editors trigger downloads, extract readable versions, and review rights of locked files. |
| **Extractors** | The six recipes that turn raw downloads (HTML, XML/TEI, plain text, PDF with OCR…) into clean readable Markdown. |
| **Verification** | Integrity check: confirms every corpus file is exactly as downloaded, unmodified. |
| **Catalog Builder** *(editors)* | Bulk-import candidate metadata from an external catalog feed (XML or JSON). |
| **Manual Fetch** *(editors)* | Texts that can only be obtained by hand — the source forbids automated downloads (robots.txt, manual-only policy, login required) and no alternative edition worked. Each entry shows the reason and a direct link; editors download the page themselves and upload it, and it still goes through the normal rights review. |
| **Runs History** | A timestamped log of every background operation, expandable to files produced and blockers raised. |
| **Policy** *(editors)* | The JSON ruleset governing what the hunter may assess and download. |
| **Source Registry** *(editors)* | The list of trusted websites the hunter may download from, with rate limits, allowed paths and rights notes. |

**Where the texts live:** everything the hunter collects is stored in the project's `data/hunter-corpus` folder — `public/` (cleared texts shown in the Library), `locked/` (awaiting rights review), `rights/` (assessment records) and `corpus.jsonl` (the provenance ledger).

---

## Admin (`/admin`)
A separate password-protected dashboard (no link in the navigation). After logging in, tabs for **Figures, Relationships, Projects, News, Publications** — each with an add form and a list with delete (after confirmation). This is where News and Publications content is written. Also offers a full database download and logout.

---

## Access levels at a glance

| Who | What they can do |
|---|---|
| **Visitor** (no login) | Browse every public page, explore the graph and database, read cleared Library texts, download open data, submit suggestions. |
| **Editor** (editor password) | Everything above, plus: edit the database, review suggestions, run the Source Hunter (cycles, downloads, rights review, manual fetch, policy and registry). |
| **Admin** (admin password) | The Admin dashboard (site content: figures, relations, projects, news, publications) — and editor rights everywhere. |
