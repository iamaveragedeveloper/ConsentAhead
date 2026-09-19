// Bundles each API handler into services/api/build/handlers/<name>.js (one file each, dependencies
// included) so the Lambda package is small and needs no node_modules.
//   node infra/build-lambda.mjs
import { createRequire } from "node:module";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extRequire = createRequire(path.join(root, "apps/extension/package.json"));
// esbuild ships with vite; reuse it so no extra dependency is needed
const esbuild = createRequire(extRequire.resolve("vite"))("esbuild");

const handlersDir = path.join(root, "services/api/src/handlers");
const outdir = path.join(root, "services/api/build");
rmSync(outdir, { recursive: true, force: true });

const entryPoints = readdirSync(handlersDir).filter((f) => f.endsWith(".ts")).map((f) => path.join(handlersDir, f));

await esbuild.build({
  entryPoints,
  outdir: path.join(outdir, "handlers"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  minify: false,
  // The Lambda nodejs20.x runtime already includes the AWS SDK v3
  external: ["@aws-sdk/*"],
  logLevel: "error",
});

console.log(`Built ${entryPoints.length} handlers into services/api/build/handlers`);
