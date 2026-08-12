---
name: CJS bundle import.meta.url shim
description: Why the production esbuild CJS bundle shims import.meta.url and why process.cwd() must not replace it
---

The production server is bundled by esbuild to CJS (`dist/index.cjs`), where `import.meta.url` is `undefined` — it crashed the deployed server (fileURLToPath(undefined)) before health checks passed.

**Rule:** keep `import.meta.url` in source; the build script (`script/build.ts`) injects a banner `const __importMetaUrl = require("url").pathToFileURL(__filename).href;` plus `define: { "import.meta.url": "__importMetaUrl" }`.

**Why not process.cwd():** the hunter route tests mock `process.cwd()` (vi.spyOn) to point at a temp dir, so cwd-based path resolution breaks them; module-URL-based paths are immune to that mock.

**How to apply:** any new server code needing its own directory can freely use `import.meta.url`; never remove the banner/define pair from the build script.
- The hunter resolves bundled data (policy/schemas/registry) relative to import.meta.url, so `script/build.ts` must copy `server/sourceHunter/data` → `dist/data`; without it every prod hunting cycle fails with ENOENT on collection-policy.json (hit Aug 2026).
