// Builds the public website into site-dist/:
//   /               landing page
//   /privacy.html   the extension's Privacy Policy   (same text as in the extension)
//   /terms.html     the extension's Terms of Use     (same text as in the extension)
//   /demo/...       the demo company site used to show the scan
//   node infra/build-site.mjs
import { createRequire } from "node:module";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extRequire = createRequire(path.join(root, "apps/extension/package.json"));
const esbuild = createRequire(extRequire.resolve("vite"))("esbuild");

const outfile = path.join(mkdtempSync(path.join(tmpdir(), "site-")), "content.mjs");
esbuild.buildSync({ entryPoints: [path.join(root, "apps/extension/src/legal/content.ts")], outfile, format: "esm", bundle: true, platform: "node", logLevel: "error" });
const { PRIVACY, TERMS, EFFECTIVE_DATE } = await import(pathToFileURL(outfile).href);
const version = JSON.parse(readFileSync(path.join(root, "apps/extension/manifest.json"), "utf8")).version;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0b0b0f;color:#e7e7ea;font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:56px 20px 96px}
nav{display:flex;gap:18px;font-size:14px;margin-bottom:40px}
a{color:#7dd3a8;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:30px;line-height:1.2;margin:0 0 6px;color:#fff}
h2{font-size:18px;margin:36px 0 8px;color:#fff}
p,li{color:#c4c4cc}
.meta{color:#8b8b95;font-size:14px;margin:0 0 24px}
ul{padding-left:20px}
footer{margin-top:56px;color:#8b8b95;font-size:13px}
.card{border:1px solid #23232b;border-radius:12px;padding:18px 20px;margin:12px 0;background:#111116}
.card b{color:#fff}`;

const page = (title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><main>
<nav><a href="/">Data Firewall</a><a href="/privacy.html">Privacy Policy</a><a href="/terms.html">Terms of Use</a><a href="/demo/index.html">Demo</a></nav>
${body}
<footer>Data Firewall ${esc(version)}</footer>
</main></body></html>
`;

function legal(doc) {
  const parts = [`<h1>${esc(doc.title)}</h1>`, `<p class="meta">Effective ${esc(EFFECTIVE_DATE)} · Version ${esc(version)}</p>`, `<p>${esc(doc.intro)}</p>`];
  doc.sections.forEach((s, i) => {
    parts.push(`<h2>${i + 1}. ${esc(s.heading)}</h2>`);
    for (const p of s.paragraphs ?? []) parts.push(`<p>${esc(p)}</p>`);
    if (s.bullets?.length) parts.push(`<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
  });
  return page(`${doc.title} | Data Firewall`, parts.join("\n"));
}

const out = path.join(root, "site-dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

writeFileSync(path.join(out, "privacy.html"), legal(PRIVACY));
writeFileSync(path.join(out, "terms.html"), legal(TERMS));
writeFileSync(
  path.join(out, "index.html"),
  page(
    "Data Firewall",
    `<h1>Data Firewall</h1>
<p class="meta">A browser extension that shows what a site will do with your data, before you share it.</p>
<div class="card"><b>Your details stay on your device.</b><br>Your vault is stored locally in your browser, separately for each account. It is never sent to a server.</div>
<div class="card"><b>Know before you fill.</b><br>When you click a form field, Data Firewall reads the site's privacy policy and terms and points to the exact sentences that matter.</div>
<div class="card"><b>Shared, public analysis only.</b><br>The only thing we keep online is our analysis of public privacy policies, so popular sites are checked once for everyone.</div>
<p><a href="/privacy.html">Privacy Policy</a> · <a href="/terms.html">Terms of Use</a> · <a href="/demo/index.html">Try the demo company site</a></p>`
  )
);
cpSync(path.join(root, "apps/demo-site"), path.join(out, "demo"), { recursive: true });

console.log("Built site-dist/ (index, privacy, terms, demo)");
