import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, cp } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    // `import.meta.url` is ESM-only; in a CJS bundle it becomes `undefined`
    // which crashes any code that passes it to `fileURLToPath()`.
    // We inject a shim into the bundle banner and rewrite every reference to
    // `import.meta.url` to use it instead.
    banner: {
      js: `const __importMetaUrl = require("url").pathToFileURL(__filename).href;`,
    },
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.url": "__importMetaUrl",
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // The source hunter resolves its bundled data (collection policy, schemas,
  // source registry) relative to the compiled module via import.meta.url —
  // in production that's dist/, so the data folder must ship alongside the
  // bundle or every hunting cycle fails with ENOENT.
  console.log("copying source hunter data...");
  await cp("server/sourceHunter/data", "dist/data", { recursive: true });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
