// Writes PRIVACY.md and TERMS.md at the repo root from src/legal/content.ts, so the text shown in
// the extension and the text in the repository (e.g. for a store listing) come from one source.
//   pnpm legal:md
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// esbuild ships with vite; resolve it from there so no extra dependency is needed
const esbuild = createRequire(require.resolve("vite"))("esbuild");

const outfile = path.join(mkdtempSync(path.join(tmpdir(), "legal-")), "content.mjs");
esbuild.buildSync({
  entryPoints: [path.join(here, "../src/legal/content.ts")],
  outfile,
  format: "esm",
  bundle: true,
  platform: "node",
  logLevel: "error",
});

const { PRIVACY, TERMS, EFFECTIVE_DATE } = await import(pathToFileURL(outfile).href);
const version = JSON.parse(readFileSync(path.join(here, "../manifest.json"), "utf8")).version;

function toMarkdown(doc, other, otherFile) {
  const lines = [
    `# Data Firewall ${doc.title}`,
    "",
    `_Effective ${EFFECTIVE_DATE} · Version ${version}_`,
    "",
    doc.intro,
    "",
  ];

  doc.sections.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.heading}`, "");
    for (const p of s.paragraphs ?? []) lines.push(p, "");
    for (const b of s.bullets ?? []) lines.push(`- ${b}`);
    if (s.bullets?.length) lines.push("");
  });

  lines.push("---", "", `Also see the [${other.title}](${otherFile}).`, "");
  return lines.join("\n");
}

const root = path.join(here, "../../..");
writeFileSync(path.join(root, "PRIVACY.md"), toMarkdown(PRIVACY, TERMS, "TERMS.md"));
writeFileSync(path.join(root, "TERMS.md"), toMarkdown(TERMS, PRIVACY, "PRIVACY.md"));
console.log(`Wrote PRIVACY.md and TERMS.md (version ${version}, effective ${EFFECTIVE_DATE})`);
