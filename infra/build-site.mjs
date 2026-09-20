// Builds the public website into site-dist/:
//   /                landing page
//   /judges.html     how to try the extension in 3 minutes (zip, steps, video, screenshots)
//   /privacy.html    the extension's Privacy Policy   (same text as in the extension)
//   /terms.html      the extension's Terms of Use     (same text as in the extension)
//   /demo/...        the demo company site used to show the scan
//   /downloads/...   the extension as a zip (built from apps/extension/dist)
//
// Optional media: put demo.mp4 (or demo.webm) and numbered screenshots (01-name.png ...) in
// infra/media/ and they appear on the judges page. Nothing is shown for media that is missing.
//   node infra/build-site.mjs
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extRequire = createRequire(path.join(root, "apps/extension/package.json"));
const esbuild = createRequire(extRequire.resolve("vite"))("esbuild");

const outfile = path.join(mkdtempSync(path.join(tmpdir(), "site-")), "content.mjs");
esbuild.buildSync({ entryPoints: [path.join(root, "apps/extension/src/legal/content.ts")], outfile, format: "esm", bundle: true, platform: "node", logLevel: "error" });
const { PRIVACY, TERMS, EFFECTIVE_DATE } = await import(pathToFileURL(outfile).href);
const version = JSON.parse(readFileSync(path.join(root, "apps/extension/manifest.json"), "utf8")).version;

// The extension's Chrome Web Store listing (unlisted, opened by link)
const STORE_URL = "https://chromewebstore.google.com/detail/personal-data-firewall/cennoldpodbdeafjjcpeocilaibnejlp";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Minimal zip writer (deflate, forward-slash paths, so it opens correctly everywhere) ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full, base) : [{ full, rel: path.relative(base, full).split(path.sep).join("/") }];
  });
}
function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); // fixed 1980-01-01 so the zip is reproducible
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ── Pages ──
const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0b0b0f;color:#e7e7ea;font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:56px 20px 96px}
nav{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14px;margin-bottom:40px}
a{color:#7dd3a8;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:30px;line-height:1.2;margin:0 0 6px;color:#fff}
h2{font-size:19px;margin:40px 0 10px;color:#fff}
p,li{color:#c4c4cc}
.meta{color:#8b8b95;font-size:14px;margin:0 0 24px}
ul,ol{padding-left:22px}li{margin:6px 0}
footer{margin-top:56px;color:#8b8b95;font-size:13px}
.card{border:1px solid #23232b;border-radius:12px;padding:18px 20px;margin:12px 0;background:#111116}
.card b{color:#fff}
.btn{display:inline-block;background:#7dd3a8;color:#06130c;font-weight:600;padding:10px 18px;border-radius:10px;margin:6px 0}
.btn:hover{text-decoration:none;filter:brightness(1.08)}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 4px}
.btn.secondary{background:transparent;color:#e7e7ea;border:1px solid #2c2c36}
.btn.secondary:hover{background:#17171d}
.small{font-size:13px;color:#8b8b95}
code{background:#1a1a21;border:1px solid #23232b;border-radius:6px;padding:1px 6px;font-size:14px;color:#e7e7ea}
table{border-collapse:collapse;width:100%;font-size:15px;margin:10px 0}
th,td{border-bottom:1px solid #23232b;padding:9px 10px;text-align:left;vertical-align:top}
th{color:#fff;font-weight:600}
video,.shot img{width:100%;border-radius:12px;border:1px solid #23232b;background:#000}
.shot{margin:18px 0}.shot figcaption{font-size:14px;color:#8b8b95;margin-top:6px}
.tag{display:inline-block;font-size:12px;border:1px solid #2c2c36;border-radius:999px;padding:1px 9px;color:#8b8b95}
.tag.ok{color:#7dd3a8;border-color:#2b5a45}`;

const page = (title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><main>
<nav><a href="/">Data Firewall</a><a href="/judges.html">For judges</a><a href="/privacy.html">Privacy Policy</a><a href="/terms.html">Terms of Use</a><a href="/demo/index.html">Demo site</a></nav>
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

// ── The extension zip, from the built extension ──
const dist = path.join(root, "apps/extension/dist");
if (!existsSync(path.join(dist, "manifest.json"))) {
  console.error("apps/extension/dist is missing. Build the extension first: pnpm build:extension");
  process.exit(1);
}
const zipName = `data-firewall-v${version}.zip`;
const zipFiles = listFiles(dist)
  .filter((f) => !f.rel.endsWith(".map") && !f.rel.startsWith(".vite/"))
  .sort((a, b) => a.rel.localeCompare(b.rel))
  // Everything sits in one folder, so unzipping gives a single folder to pick in "Load unpacked"
  .map((f) => ({ name: `data-firewall/${f.rel}`, data: readFileSync(f.full) }));
mkdirSync(path.join(out, "downloads"), { recursive: true });
const zipBuf = makeZip(zipFiles);
writeFileSync(path.join(out, "downloads", zipName), zipBuf);
const zipKb = Math.round(zipBuf.length / 1024);

// Chrome Web Store zip: manifest.json must be at the top level (no wrapping folder). Not published on the site.
const storeDir = path.join(root, "store-dist");
rmSync(storeDir, { recursive: true, force: true });
mkdirSync(storeDir, { recursive: true });
const storeName = `data-firewall-store-v${version}.zip`;
writeFileSync(path.join(storeDir, storeName), makeZip(zipFiles.map((f) => ({ name: f.name.replace(/^data-firewall\//, ""), data: f.data }))));

// ── Optional media ──
const mediaDir = path.join(root, "infra/media");
const media = existsSync(mediaDir) ? readdirSync(mediaDir) : [];
const video = media.find((f) => /^demo\.(mp4|webm)$/i.test(f));
const shots = media.filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
if (media.length) cpSync(mediaDir, path.join(out, "media"), { recursive: true });
const captionFor = (f) => f.replace(/\.[^.]+$/, "").replace(/^\d+[-_]?/, "").replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

const videoBlock = video
  ? `<h2>Watch the demo</h2>
<video controls preload="metadata" playsinline src="/media/${esc(video)}"></video>`
  : "";
const shotsBlock = shots.length
  ? `<h2>Screenshots</h2>` + shots.map((f) => `<figure class="shot"><img loading="lazy" src="/media/${esc(f)}" alt="${esc(captionFor(f))}"><figcaption>${esc(captionFor(f))}</figcaption></figure>`).join("")
  : "";

const judges = `<h1>For judges</h1>
<p class="meta">Data Firewall ${esc(version)} · a Chrome extension that shows what a site will do with your data before you share it</p>

<div class="card"><b>The idea in one line.</b><br>Open the extension on a page with a form. It reads that site's privacy policy and terms right in your browser, points to the exact sentences that matter, and fills the form from a private vault that never leaves your device.</div>

${videoBlock}

<h2>Try it in 3 minutes</h2>
<div class="actions">
<a class="btn" href="${STORE_URL}" target="_blank" rel="noopener">View in Chrome Web Store</a>
<a class="btn secondary" href="/downloads/${esc(zipName)}">Manual download (${zipKb} KB)</a>
</div>
<p class="small">Install from the store in one click, or download the zip if you prefer to load it yourself.</p>
<ol>
<li><b>Install.</b> Click <b>View in Chrome Web Store</b> and press <b>Add to Chrome</b>. Or use the manual download: unzip it, open <code>chrome://extensions</code>, switch on <b>Developer mode</b> (top right), click <b>Load unpacked</b> and choose the <code>data-firewall</code> folder.</li>
<li>Click the extension icon. It asks you to create an account: use any name, email and password. It takes 20 seconds and stays on your device. Then save a few details in the Vault.</li>
<li>Open the <a href="/demo/index.html">demo company sign-up page</a>. Click the extension icon in the Chrome toolbar (pin it from the puzzle-piece menu if you don't see it).</li>
<li>Watch the privacy scan run. Open a finding to jump to the exact sentence in the company's policy, highlighted.</li>
<li>Choose what to fill and press <b>Fill</b>.</li>
<li>Optional: press <b>Turn on</b> at the bottom of the popup to have a small shield appear beside form fields on that site from then on.</li>
</ol>
<p class="small">Also works on any real form, including Google Forms. Nothing is submitted for you.</p>

${shotsBlock}

<h2>What runs where</h2>
<table>
<tr><th>Part</th><th>Where it runs</th><th>Status</th></tr>
<tr><td>Your vault, accounts, activity</td><td>Your browser only, separate for each account</td><td><span class="tag ok">Working</span></td></tr>
<tr><td>Privacy scan (policy and terms reading, evidence highlighting)</td><td>Your browser, no server needed</td><td><span class="tag ok">Working</span></td></tr>
<tr><td>Autofill, including Google Forms and dates of birth</td><td>Your browser</td><td><span class="tag ok">Working</span></td></tr>
<tr><td>This website (policy, terms, demo, download)</td><td>Amazon S3 + CloudFront</td><td><span class="tag ok">Live</span></td></tr>
<tr><td>Shared analysis API</td><td>Amazon API Gateway + AWS Lambda</td><td><span class="tag ok">Deployed</span></td></tr>
<tr><td>AI reading of long policies</td><td>Amazon Bedrock (Nova Lite)</td><td><span class="tag">Deployed, awaiting account quota</span></td></tr>
<tr><td>Cache of public policy analyses</td><td>Amazon DynamoDB (domain + policy hash, 30-day expiry)</td><td><span class="tag ok">Deployed</span></td></tr>
</table>
<p>The only thing stored on AWS is public information about company policies. Names, emails, passwords, vault contents and browsing history never leave your device. In this build the extension uses its on-device scan; connecting it to the cloud analysis is an opt-in feature still to come.</p>

<h2>Worth knowing</h2>
<ul>
<li><b>Accounts are local.</b> They live in your browser, so a judge creates their own. Each account on a device gets its own separate vault.</li>
<li><b>The sign-in is a lock, not encryption of the vault.</b> Someone with access to your browser profile could still read stored data. This is stated in the Privacy Policy.</li>
<li><b>Nothing is submitted for you.</b> The extension fills fields and stops. You press submit.</li>
</ul>

<p><a href="/privacy.html">Privacy Policy</a> · <a href="/terms.html">Terms of Use</a></p>`;

writeFileSync(path.join(out, "judges.html"), page("For judges | Data Firewall", judges));
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
<p><a class="btn" href="/judges.html">Try it (for judges)</a></p>
<p><a href="/privacy.html">Privacy Policy</a> · <a href="/terms.html">Terms of Use</a> · <a href="/demo/index.html">Demo company site</a></p>`
  )
);
cpSync(path.join(root, "apps/demo-site"), path.join(out, "demo"), { recursive: true });

console.log(`Chrome Web Store zip: store-dist/${storeName}`);
console.log(`Built site-dist/ (index, judges, privacy, terms, demo, downloads/${zipName} ${zipKb} KB${video ? ", video" : ""}${shots.length ? `, ${shots.length} screenshots` : ""})`);
