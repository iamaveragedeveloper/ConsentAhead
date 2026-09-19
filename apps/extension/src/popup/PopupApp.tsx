import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileSearch,
  Loader2,
  Lock,
  Minus,
  Settings,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { DisclosureField, DisclosurePreview, VaultProfile } from "@consent-ahead/shared-types";
import { getCategoryLabel } from "@consent-ahead/field-classifier";
import { getVaultState, resolveVaultValue, type VaultState } from "../vault/vaultStore";
import { recordDisclosure } from "../disclosure/disclosureRecorder";
import { getLastAccount, getSession, signOut, type Account } from "../auth/authStore";
import {
  guessDocument,
  readSameSiteThroughTab,
  scanDocument,
  type DocKind,
  type ScanFinding,
  type SourceResult,
  type Tone,
} from "../privacy/policyScanner";
import { enableShield, registerShield, shieldEnabled, siteKey } from "../access/siteShield";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { cn } from "../lib/utils";

type Screen = "loading" | "signin" | "unknown" | "unsupported" | "no-access" | "scanning" | "no-form" | "ready" | "done";
type FillMode = "minimum" | "all";
type StepState = "idle" | "active" | "done" | "missing";
type StepKey = "form" | "privacy" | "terms" | "analyze";

interface FillResult {
  filled: number;
  total: number;
  error?: string;
}

interface ScanState {
  running: boolean;
  results: SourceResult[];
  missing: DocKind[]; // documents we could not find a link (or common path) for
  target: number; // where the progress bar is heading (0-100)
  stage: string; // what is happening right now
  steps: Record<StepKey, StepState>;
}

// The scan starts the moment the popup opens: step one is reading the form
const INITIAL_SCAN: ScanState = {
  running: true,
  results: [],
  missing: [],
  target: 14,
  stage: "Reading the form fields…",
  steps: { form: "active", privacy: "idle", terms: "idle", analyze: "idle" },
};

// The real work is often over in milliseconds, which is too fast to follow. Each stage is held
// for at least this long so you can watch the scan happen (about 2.8 seconds in total).
const PACE = {
  form: 500, // "Reading the form fields…"
  privacy: 800, // policy tick, counted from when documents start loading
  terms: 1200, // terms tick, so the two steps complete one after the other
  analyze: 700, // "Working out how your data is used…"
  finish: 350, // hold at 100% for a beat before the results replace the bar
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const openDashboard = () => chrome.runtime.openOptionsPage();
// Opens the sign-in page in a tab, then closes the popup
const openSignIn = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("auth.html") });
  window.close();
};
const openLegal = (page: "privacy" | "terms") => chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#/${page}`) });

// Colour guidance for data sensitivity
const RISK = {
  low: { dot: "bg-emerald-400", label: "Low" },
  medium: { dot: "bg-amber-400", label: "Medium" },
  high: { dot: "bg-red-400", label: "Sensitive" },
  unknown: { dot: "bg-zinc-500", label: "Unknown" },
} as const;

// Colour guidance for privacy findings
const TONE = {
  warn: { dot: "bg-red-400" },
  note: { dot: "bg-amber-400" },
  good: { dot: "bg-emerald-400" },
} as const;

export function PopupApp() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [domain, setDomain] = useState("");
  const [origin, setOrigin] = useState("");
  const [tabId, setTabId] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [shield, setShield] = useState<"on" | "off" | null>(null);
  const [shieldDenied, setShieldDenied] = useState(false);

  const [preview, setPreview] = useState<DisclosurePreview | null>(null);
  const [fields, setFields] = useState<DisclosureField[]>([]);
  const [mode, setMode] = useState<FillMode>("all");
  const [vault, setVault] = useState<{ state: VaultState; profile: VaultProfile | null } | null>(null);
  const [result, setResult] = useState<FillResult | null>(null);
  const [scan, setScan] = useState<ScanState>(INITIAL_SCAN);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [knownAccount, setKnownAccount] = useState<Account | null>(null);
  const startedAt = useRef(Date.now());
  const barValue = useRef(0); // how far the progress bar has actually got (0-100)

  // ── Flow: check access → (ask) → read the form ──────────────────────────────

  const scanPage = useCallback(async (id: number) => {
    startedAt.current = Date.now();
    setScan(INITIAL_SCAN);
    setScreen("scanning");
    try {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ["content.js"] });
    } catch {
      return setScreen("no-form");
    }
    const res = await chrome.tabs.sendMessage(id, { type: "TRIGGER_SCAN" }).catch(() => null);
    if (!res?.preview) return setScreen("no-form");
    const p: DisclosurePreview = res.preview;
    setPreview(p);
    setFields(p.fields);
    setScreen("ready");
  }, []);

  useEffect(() => {
    (async () => {
      // Everything below needs a signed-in account
      if (!(await getSession())) {
        setKnownAccount(await getLastAccount());
        return setScreen("signin");
      }
      getVaultState().then(setVault);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return setScreen("unsupported");

      // Chrome hides a tab's URL until the extension has access to the site. When the popup was
      // opened from the shield on the page, that click passed the URL along.
      let tabUrl = tab.url;
      // Chrome shows the URL only when the extension may act on this tab: after a click on the
      // toolbar icon (activeTab) or when the site was allowed. Then no extra prompt is needed.
      const hasTabAccess = Boolean(tabUrl);
      if (!tabUrl) {
        const { pendingTab } = await chrome.storage.session.get("pendingTab");
        if (pendingTab?.tabId === tab.id) tabUrl = pendingTab.url;
      }
      if (!tabUrl) return setScreen("unknown");

      let url: URL;
      try {
        url = new URL(tabUrl);
      } catch {
        return setScreen("unsupported");
      }
      if (!/^(https?|file):$/.test(url.protocol)) return setScreen("unsupported");

      setDomain(url.hostname || "Local file");
      setOrigin(url.origin);
      setTabId(tab.id);

      const siteAllowed = await chrome.permissions.contains({ origins: [`${siteKey(url.origin)}/*`] });
      if (!(url.protocol === "file:" || hasTabAccess || siteAllowed)) return setScreen("no-access");

      // Without permanent access, the site's own policy is read through the page itself
      if (!siteAllowed) readSameSiteThroughTab(tab.id, url.origin);
      if (url.protocol !== "file:") setShield((await shieldEnabled(url.origin)) ? "on" : "off");

      await scanPage(tab.id);
    })();
  }, [scanPage]);

  const allowAccess = async () => {
    setDenied(false);
    const granted = await chrome.permissions.request({ origins: [`${siteKey(origin)}/*`] });
    if (granted && tabId !== null) {
      await registerShield(origin);
      setShield("on");
      await scanPage(tabId);
    } else setDenied(true);
  };

  const turnOnShield = async () => {
    setShieldDenied(false);
    const ok = await enableShield(origin, tabId);
    setShield(ok ? "on" : "off");
    if (!ok) setShieldDenied(true);
  };

  useEffect(() => {
    if (!confirmLogout) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirmLogout(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmLogout]);

  const handleSignOut = async () => {
    await signOut();
    window.close();
  };

  // ── Privacy scan: form is known → read the policy and terms, with live progress ─

  const runScan = useCallback(async (p: DisclosurePreview, pageOrigin: string) => {
    const patch = (partial: Partial<ScanState>, steps?: Partial<ScanState["steps"]>) =>
      setScan((s) => ({ ...s, ...partial, steps: { ...s.steps, ...steps } }));

    // Step 1: the form has been read; keep that stage on screen long enough to see it
    await sleep(Math.max(0, PACE.form - (Date.now() - startedAt.current)));

    // Step 2: policy and terms are read in parallel
    const docsStart = Date.now();
    patch(
      { running: true, results: [], missing: [], target: 42, stage: "Finding the privacy policy and terms…" },
      { form: "done", privacy: "active", terms: "active" }
    );

    const finished = (kind: DocKind, found: boolean) =>
      patch(
        kind === "privacy"
          ? { target: 64, stage: "Reading the terms…" }
          : { target: 86, stage: "Reading the policy…" },
        { [kind]: found ? "done" : "missing" }
      );

    const job = async (kind: DocKind, url: string | undefined) => {
      const r = url ? await scanDocument(kind, url) : await guessDocument(kind, pageOrigin);
      if (r) setScan((s) => ({ ...s, results: [...s.results.filter((x) => x.kind !== r.kind), r] }));
      else setScan((s) => ({ ...s, missing: [...s.missing, kind] }));
      // Even if the document arrived instantly, tick the steps off one after the other
      await sleep(Math.max(0, PACE[kind] - (Date.now() - docsStart)));
      finished(kind, Boolean(r) && r?.status !== "failed");
    };

    const termsUrl = p.termsUrl && p.termsUrl !== p.policyUrl ? p.termsUrl : undefined;
    await Promise.all([job("privacy", p.policyUrl), job("terms", termsUrl)]);

    // Step 3: analysis
    patch({ target: 96, stage: "Working out how your data is used…" }, { analyze: "active" });
    await sleep(PACE.analyze);

    // Step 4: complete the bar, then swap in the results
    patch({ target: 100, stage: "Done" }, { analyze: "done" });
    // Wait for the bar to actually reach the end (it is speed-limited), then hold briefly
    for (let waited = 0; barValue.current < 99.5 && waited < 3000; waited += 50) await sleep(50);
    await sleep(PACE.finish);
    patch({ running: false });
  }, []);

  useEffect(() => {
    if (preview && origin) void runScan(preview, origin);
  }, [preview, origin, runScan]);

  const allowPolicySite = async (r: SourceResult) => {
    if (!r.origin) return;
    const granted = await chrome.permissions.request({ origins: [`${siteKey(r.origin)}/*`] });
    if (!granted) return;
    const fresh = await scanDocument(r.kind, r.url, { force: true });
    setScan((s) => ({ ...s, results: [...s.results.filter((x) => x.kind !== r.kind), fresh] }));
  };

  // ── Form + fill ─────────────────────────────────────────────────────────────

  const valueFor = useCallback(
    (f: DisclosureField) => (f.vaultKey ? resolveVaultValue(vault?.profile ?? null, f.vaultKey) : undefined),
    [vault]
  );

  const applyMode = (next: FillMode) => {
    setMode(next);
    setFields((prev) => prev.map((f) => ({ ...f, selected: next === "all" ? true : f.requirement === "required" })));
  };

  const toggle = (id: string) =>
    setFields((prev) => prev.map((f) => (f.fieldId === id ? { ...f, selected: !f.selected } : f)));

  const fillable = useMemo(() => fields.filter((f) => f.selected && valueFor(f)), [fields, valueFor]);
  const sensitiveCount = fields.filter((f) => f.sensitivity === "high").length;

  const handleFill = async () => {
    if (!preview || tabId === null || fillable.length === 0) return;

    const ops = fillable.map((f) => ({
      selector: f.selector ?? `[id="${f.fieldId}"], [name="${f.fieldId}"]`,
      value: valueFor(f)!,
    }));

    const res = await chrome.tabs.sendMessage(tabId, { type: "FILL_FIELDS", payload: { fields: ops } }).catch(() => null);
    const filled: number = res?.filled ?? 0;

    if (filled > 0) {
      await recordDisclosure({
        domain: preview.domain,
        pageUrl: preview.domain,
        selectedFields: fillable,
        findings: preview.findings,
        fillMode: mode === "minimum" ? "minimum" : "full",
        policyUrl: preview.policyUrl,
      });
    }

    setResult({
      filled,
      total: fillable.length,
      error: filled === 0 ? "The form could not be filled. Refresh the page and try again." : undefined,
    });
    setScreen("done");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const showScanLayout = screen === "scanning" || screen === "ready";

  return (
    <div className={cn("flex max-h-[600px] w-[380px] flex-col bg-background", screen !== "signin" && "min-h-[300px]")}>
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold leading-none">Data Firewall</h1>
          <p className="mt-1 truncate text-xs text-muted-foreground">{domain || (screen === "signin" ? "Signed out" : "\u00A0")}</p>
        </div>
        {screen !== "signin" && screen !== "loading" && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={openDashboard} title="Dashboard">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-muted-foreground" onClick={() => setConfirmLogout(true)}>
              Logout
            </Button>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-4">
        {screen === "loading" && (
          <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading…
          </div>
        )}

        {screen === "signin" && <SignedOut account={knownAccount} onContinue={openSignIn} />}

        {screen === "unknown" && (
          <Centered icon={<ShieldCheck className="h-8 w-8 text-primary" />} title="Ready when you are">
            Open a page with a form, then click the Data Firewall icon in your toolbar.
          </Centered>
        )}

        {screen === "unsupported" && (
          <Centered icon={<FileSearch className="h-8 w-8 text-muted-foreground" />} title="Not available here">
            Data Firewall works on regular web pages.
          </Centered>
        )}

        {screen === "no-access" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold">Allow access to {domain}?</p>
              <p className="mx-auto mt-2 max-w-[290px] text-xs leading-relaxed text-muted-foreground">
                Data Firewall will read this page's form fields and its privacy policy so it can show how your details
                will be used. Your personal details never leave this browser.
              </p>
            </div>
            {denied && <p className="text-xs text-amber-400">Access wasn't granted, so nothing was scanned.</p>}
            <div className="w-full space-y-2">
              <Button className="w-full" onClick={allowAccess}>
                Allow access
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => window.close()}>
                Not now
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              By allowing, you agree to the{" "}
              <button onClick={() => openLegal("terms")} className="underline hover:text-foreground">
                Terms of Use
              </button>{" "}
              and{" "}
              <button onClick={() => openLegal("privacy")} className="underline hover:text-foreground">
                Privacy Policy
              </button>
              .
            </p>
          </div>
        )}

        {screen === "no-form" && (
          <Centered icon={<FileSearch className="h-8 w-8 text-muted-foreground" />} title="No form found">
            Open a page with a sign-up or contact form, then click the Data Firewall icon again.
          </Centered>
        )}

        {screen === "done" && result && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {result.error ? (
              <XCircle className="h-10 w-10 text-red-400" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            )}
            <div>
              <p className="text-base font-semibold">
                {result.error ? "Nothing was filled" : `Filled ${result.filled} of ${result.total} fields`}
              </p>
              <p className="mx-auto mt-1 max-w-[280px] text-xs text-muted-foreground">
                {result.error ?? "Review the form, then submit it yourself. Data Firewall never submits for you."}
              </p>
            </div>
            <Button variant="secondary" className="mt-2 w-full" onClick={() => setScreen("ready")}>
              Back
            </Button>
          </div>
        )}

        {showScanLayout && (
          <div className="space-y-4">
            {/* The scan is the first thing you see: progress while it works, results when done */}
            <PrivacyScan scan={scan} onAllow={allowPolicySite} barValue={barValue} />

            {/* Autofill options appear below it */}
            <section className="space-y-3">
              {screen === "scanning" ? (
                <FieldsSkeleton />
              ) : (
                <>
                  <VaultNotice state={vault?.state} />

                  <div className="rise flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {fields.length} field{fields.length === 1 ? "" : "s"}
                      {sensitiveCount > 0 && (
                        <>
                          {" · "}
                          <span className="text-red-400">{sensitiveCount} sensitive</span>
                        </>
                      )}
                    </p>
                    <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                      <ModeButton active={mode === "minimum"} onClick={() => applyMode("minimum")}>
                        Required
                      </ModeButton>
                      <ModeButton active={mode === "all"} onClick={() => applyMode("all")}>
                        All
                      </ModeButton>
                    </div>
                  </div>

                  {fields.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No personal-data fields detected.</p>
                  ) : (
                    <ul className="overflow-hidden rounded-xl border bg-card">
                      {fields.map((f, i) => (
                        <FieldRow key={f.fieldId} field={f} index={i} value={valueFor(f)} onToggle={() => toggle(f.fieldId)} />
                      ))}
                    </ul>
                  )}

                  <Legend />
                </>
              )}
            </section>
          </div>
        )}
      </main>

      {screen === "ready" && (
        <footer className="space-y-2.5 border-t bg-card/50 p-3">
          {shield === "off" && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] leading-snug text-muted-foreground">
                {shieldDenied ? "Access wasn't granted." : `Show the shield beside fields on ${domain}?`}
              </p>
              <button
                onClick={turnOnShield}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                Turn on
              </button>
            </div>
          )}
          <Button className="w-full" disabled={fillable.length === 0} onClick={handleFill}>
            {fillable.length === 0 ? "Nothing to fill" : `Fill ${fillable.length} field${fillable.length === 1 ? "" : "s"}`}
          </Button>
        </footer>
      )}

      {confirmLogout && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          onClick={() => setConfirmLogout(false)}
        >
          <div className="w-full max-w-[300px] rounded-xl border bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="logout-title" className="text-sm font-semibold">
              Log out of Data Firewall?
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              You'll need to sign in again to use it. Your saved details stay on this device.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" autoFocus onClick={() => setConfirmLogout(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleSignOut}>
                Log out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Privacy scan card (top of popup) ─────────────────────────────────────────

function verdictOf(findings: ScanFinding[]) {
  if (findings.some((f) => f.tone === "warn")) return { label: "Concerns", cls: "bg-red-500/15 text-red-400" };
  if (findings.some((f) => f.tone === "note")) return { label: "Worth a look", cls: "bg-amber-500/15 text-amber-400" };
  if (findings.length > 0) return { label: "Looks reasonable", cls: "bg-emerald-500/15 text-emerald-400" };
  return { label: "Unclear", cls: "bg-zinc-500/20 text-zinc-300" };
}

function PrivacyScan({
  scan,
  onAllow,
  barValue,
}: {
  scan: ScanState;
  onAllow: (r: SourceResult) => void;
  barValue: React.MutableRefObject<number>;
}) {
  const [showAll, setShowAll] = useState(false);

  const findings = useMemo(() => {
    const order: Record<Tone, number> = { warn: 0, note: 1, good: 2 };
    return scan.results.flatMap((r) => r.findings).sort((a, b) => order[a.tone] - order[b.tone]);
  }, [scan.results]);

  // While scanning: a moving progress bar with live steps
  if (scan.running) {
    return (
      <section className="rounded-xl border bg-card p-3.5">
        <ScanProgress scan={scan} barValue={barValue} />
      </section>
    );
  }

  const verdict = verdictOf(findings);
  const needsPermission = scan.results.filter((r) => r.status === "needs-permission");
  const links = scan.results.filter((r) => r.status !== "failed");
  const visible = showAll ? findings : findings.slice(0, 4);
  const noDocs = scan.results.every((r) => r.status !== "ok") && needsPermission.length === 0;

  return (
    <section className="fade-in rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Privacy scan</h2>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", verdict.cls)}>{verdict.label}</span>
      </div>

      {visible.length > 0 && (
        <ul className="mt-2 divide-y">
          {visible.map((f, i) => (
            <FindingRow key={f.id} finding={f} index={i} />
          ))}
        </ul>
      )}

      {findings.length > 4 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-primary hover:underline">
          {showAll ? "Show fewer" : `Show all ${findings.length}`}
        </button>
      )}

      {needsPermission.map((r) => (
        <div key={r.kind} className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted p-2.5">
          <p className="text-xs text-muted-foreground">
            The {r.kind === "privacy" ? "privacy policy" : "terms"} is on <span className="text-foreground">{new URL(r.url).hostname}</span>.
          </p>
          <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => onAllow(r)}>
            Allow &amp; read
          </Button>
        </div>
      ))}

      {noDocs && (
        <p className="mt-2 text-xs text-muted-foreground">
          {scan.missing.length === 2
            ? "No privacy policy or terms were found for this site."
            : "The policy couldn't be read automatically. Open it below to check it yourself."}
        </p>
      )}

      {links.length > 0 && (
        <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
          {links.map((r) => (
            <a
              key={r.kind}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              {r.kind === "privacy" ? "Privacy policy" : "Terms"} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

// A progress bar that eases toward wherever the scan has actually got to, and keeps creeping
// so it never looks stuck while a slow network request is in flight.
function ScanProgress({ scan, barValue }: { scan: ScanState; barValue: React.MutableRefObject<number> }) {
  const [value, setValue] = useState(3);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((v) => {
        const finishing = scan.target >= 100;
        const cap = finishing ? 100 : Math.min(scan.target + 4, 97); // a little ahead of the last milestone
        // Speed-limited (about 30% a second) so the bar glides and never jumps ahead of the stages
        const step = Math.min(Math.max((cap - v) * 0.16, 0.12), finishing ? 2.4 : 1.6);
        const next = Math.min(v + step, cap);
        barValue.current = next;
        return next;
      });
    }, 45);
    return () => window.clearInterval(id);
  }, [scan.target]);

  const STEPS: { key: StepKey; label: string }[] = [
    { key: "form", label: "Form" },
    { key: "privacy", label: "Policy" },
    { key: "terms", label: "Terms" },
    { key: "analyze", label: "Analysis" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Privacy scan</h2>
        <span className="text-xs font-medium tabular-nums text-primary">{Math.round(value)}%</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="shimmer h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-400"
          style={{ width: `${value}%`, transition: "width 60ms linear" }}
        />
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">{scan.stage}</p>

      <ul className="mt-3 grid grid-cols-4 gap-1.5">
        {STEPS.map((s) => (
          <li key={s.key} className="flex items-center gap-1 text-[11px]">
            <StepIcon state={scan.steps[s.key]} />
            <span className={cn("truncate", scan.steps[s.key] === "idle" ? "text-muted-foreground/60" : "text-foreground")}>
              {s.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (state === "active") return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />;
  if (state === "missing") return <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  return <span className="ml-1 mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />;
}

function FindingRow({ finding, index }: { finding: ScanFinding; index: number }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[finding.tone];
  return (
    <li className="rise py-2" style={{ animationDelay: `${index * 45}ms` }}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
        <span className="flex-1 text-sm">{finding.title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-[18px] mt-1.5 text-xs text-muted-foreground">
          <blockquote className="border-l-2 pl-2 italic">“{finding.evidence}”</blockquote>
          <a
            href={finding.highlightUrl ?? finding.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-primary hover:underline"
          >
            Show in {finding.source === "privacy" ? "privacy policy" : "terms"} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </li>
  );
}

// ── Form pieces ──────────────────────────────────────────────────────────────

function FieldsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
      <ul className="overflow-hidden rounded-xl border bg-card">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-3 border-b px-3 py-3 last:border-b-0">
            <span className="h-2 w-2 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Centered({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-[260px] text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
      {(["low", "medium", "high"] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", RISK[k].dot)} />
          {RISK[k].label}
        </span>
      ))}
    </div>
  );
}

function VaultNotice({ state }: { state?: VaultState }) {
  if (!state || state === "ok") return null;
  return (
    <Alert variant="warning" className="flex items-center justify-between gap-3 py-2.5">
      <AlertDescription className="text-xs">
        {state === "unreadable" ? "Your vault can't be read." : "Your vault is empty."}
      </AlertDescription>
      <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={openDashboard}>
        Fix
      </Button>
    </Alert>
  );
}

function FieldRow({
  field,
  value,
  index,
  onToggle,
}: {
  field: DisclosureField;
  value?: string;
  index: number;
  onToggle: () => void;
}) {
  const risk = RISK[field.sensitivity] ?? RISK.unknown;
  const hint = value ? null : field.vaultKey ? "Not in your vault" : "Fill this one manually";

  return (
    <li
      onClick={onToggle}
      className="rise flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-accent/50"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", risk.dot)} title={risk.label} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-medium">{field.label || getCategoryLabel(field.category)}</span>
          {field.requirement === "required" && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">req</span>
          )}
        </div>
        <p className={cn("truncate text-xs", hint ? "text-amber-400/80" : "text-muted-foreground")}>{value ?? hint}</p>
      </div>
      <Checkbox
        checked={field.selected}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Fill ${field.label}`}
      />
    </li>
  );
}

// ── Signed out ───────────────────────────────────────────────────────────────

function SignedOut({ account, onContinue }: { account: Account | null; onContinue: () => void }) {
  const first = account?.name.split(" ").filter(Boolean)[0];
  return (
    <div className="space-y-5 pt-2">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {account ? `Welcome back${first ? `, ${first}` : ""}` : "Get started"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {account ? "Sign in to continue." : "Create an account to scan forms and fill them safely."}
        </p>
      </div>

      <div className="space-y-3">
        <Button className="h-10 w-full" onClick={onContinue}>
          {account ? "Sign in" : "Create account"}
        </Button>
        <p className="text-xs text-muted-foreground">Your details stay on this device.</p>
      </div>
    </div>
  );
}
