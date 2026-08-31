# Hunter Bot API

This API gives a trusted autonomous agent editor-level access to the Source
Hunter and its complete corpus, including locked texts.

## Authentication

Set the secret `HUNTER_BOT_API_TOKEN` in SHADOWS and put the same value in the
agent's secure environment. Every request must send:

```http
Authorization: Bearer YOUR_TOKEN
```

Never put the token in a prompt, URL, source file, or chat message.

## Discover the API

```http
GET /api/bot/hunter
GET /api/bot/hunter/openapi.json
```

The second endpoint is an OpenAPI 3.1 document that Codex and other agents can
use as tool documentation.

## Typical agent workflow

1. Start a search:

   ```http
   POST /api/bot/hunter/search
   Content-Type: application/json

   {"query":"Epic of Gilgamesh","limit":10,"use_ai":true}
   ```

   `region_id` may be used with or instead of `query`. Search uses the same
   parameters and filters as the Hunter editor interface.

2. Poll the URL in `links.poll` until the run status is `completed` or
   `failed`. A completed run includes files and blockers.

3. List corpus texts:

   ```http
   GET /api/bot/hunter/texts?q=gilgamesh
   GET /api/bot/hunter/texts?partition=locked
   GET /api/bot/hunter/texts?language=en&source_id=source:internet-archive
   ```

   The inventory includes public and locked texts by default.

4. Read or download a text:

   ```http
   GET /api/bot/hunter/texts/12
   GET /api/bot/hunter/texts/12/content
   GET /api/bot/hunter/texts/12/download
   ```

   `/content` returns extracted Markdown when available, otherwise raw UTF-8
   text. Binary files without an extracted version return `415` and point to
   the download endpoint.

## Safety

- The API accepts database IDs, never filesystem paths.
- Both public and locked texts are available because the Bearer token grants
  editor-level access.
- Treat locked texts according to the rights metadata returned with the text.
- Rotate `HUNTER_BOT_API_TOKEN` immediately if it is exposed.