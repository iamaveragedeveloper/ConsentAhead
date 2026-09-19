import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Database, History, LayoutDashboard, Lock, LogOut, ShieldCheck } from "lucide-react";
import { getAllCompanies, getAllDisclosureEvents, getVaultState } from "../vault/vaultStore";
import { cn } from "../lib/utils";
import { getSession, signOut, type Account } from "../auth/authStore";
import { summarize } from "./lib";
import type { DashData } from "./types";
import { ActivityPage } from "./pages/ActivityPage";
import { CompaniesPage } from "./pages/CompaniesPage";
import { DataPage } from "./pages/DataPage";
import { LegalPage } from "./pages/LegalPage";
import { LEGAL_DOCS } from "../legal/content";
import { OverviewPage } from "./pages/OverviewPage";
import { VaultPage } from "./pages/VaultPage";

const PAGES = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, title: "Overview", description: "Your data footprint at a glance" },
  { id: "vault", label: "Vault", icon: Lock, title: "Vault", description: "The details Data Firewall can fill for you" },
  { id: "activity", label: "Activity", icon: History, title: "Activity", description: "Every form you've filled, newest first" },
  { id: "companies", label: "Companies", icon: Building2, title: "Companies", description: "Who has your data, and how to take it back" },
  { id: "data", label: "Data & access", icon: Database, title: "Data & access", description: "Control site access, export or delete your data" },
] as const;

type PageId = (typeof PAGES)[number]["id"];
type LegalId = "privacy" | "terms";
type RouteId = PageId | LegalId;

const LEGAL_DESCRIPTIONS: Record<LegalId, string> = {
  privacy: "How Data Firewall handles your information",
  terms: "The rules for using Data Firewall",
};

const pageFromHash = (): RouteId => {
  const id = window.location.hash.replace(/^#\/?/, "");
  if (id === "privacy" || id === "terms") return id;
  return (PAGES.find((p) => p.id === id)?.id ?? "overview") as PageId;
};

export function DashboardApp() {
  const [page, setPage] = useState<RouteId>(pageFromHash);
  const [vault, setVault] = useState<DashData["vault"]>(null);
  const [events, setEvents] = useState<DashData["events"]>([]);
  const [companies, setCompanies] = useState<DashData["companies"]>([]);
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const reload = useCallback(async () => {
    const [v, evts, comps] = await Promise.all([getVaultState(), getAllDisclosureEvents(), getAllCompanies()]);
    setVault(v);
    setEvents(evts);
    setCompanies(comps);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Everything except the legal pages needs a signed-in account
  useEffect(() => {
    (async () => {
      const session = await getSession();
      setAccount(session);
      setAuthChecked(true);
      if (!session && page !== "privacy" && page !== "terms") {
        window.location.replace(chrome.runtime.getURL("auth.html"));
      }
    })();
  }, [page]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: string) => {
    window.location.hash = `/${id}`;
  };

  const summary = useMemo(() => summarize(events), [events]);
  const data: DashData = { vault, events, companies, summary, account, reload };
  const legalId = page === "privacy" || page === "terms" ? page : null;
  const current = legalId
    ? { title: LEGAL_DOCS[legalId].title, description: LEGAL_DESCRIPTIONS[legalId] }
    : (PAGES.find((p) => p.id === page) ?? PAGES[0]);
  const version = chrome.runtime.getManifest().version;

  const handleSignOut = async () => {
    await signOut();
    window.location.replace(chrome.runtime.getURL("auth.html"));
  };

  if (!authChecked) return null;

  // Signed out: only the legal pages are viewable, in a simple layout with no navigation
  if (!account) {
    if (!legalId) return null; // redirecting to sign-in
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold">Data Firewall</p>
          </div>
          <a href={chrome.runtime.getURL("auth.html")} className="text-sm text-primary hover:underline">
            Sign in
          </a>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{current.description}</p>
        <LegalPage id={legalId} go={go} />
      </div>
    );
  }

  return (
    <div className="min-h-screen md:pl-64">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card/40 md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Data Firewall</p>
            <p className="mt-1 text-xs text-muted-foreground">Privacy dashboard</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {PAGES.map((p) => (
            <NavLink key={p.id} active={page === p.id} onClick={() => go(p.id)} icon={<p.icon className="h-4 w-4" />}>
              {p.label}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                vault?.state === "ok" ? "bg-emerald-400" : vault?.state === "unreadable" ? "bg-red-400" : "bg-amber-400"
              )}
            />
            <span className="font-medium">
              {vault?.state === "ok" ? "Vault ready" : vault?.state === "unreadable" ? "Vault unreadable" : "Vault empty"}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Everything here is stored only on this device. Nothing is ever sent to a server.
          </p>
        </div>

        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold uppercase text-primary">
            {account.name.slice(0, 1) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{account.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{account.email}</p>
          </div>
          <button onClick={handleSignOut} title="Sign out" className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-5 pb-4 text-[11px] text-muted-foreground">
          <div className="flex gap-3">
            <button onClick={() => go("privacy")} className={cn("hover:text-foreground", page === "privacy" && "text-foreground")}>
              Privacy
            </button>
            <button onClick={() => go("terms")} className={cn("hover:text-foreground", page === "terms" && "text-foreground")}>
              Terms
            </button>
          </div>
          <span>v{version}</span>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b bg-background/90 px-3 py-2 backdrop-blur md:hidden">
        {PAGES.map((p) => (
          <NavLink key={p.id} active={page === p.id} onClick={() => go(p.id)} icon={<p.icon className="h-4 w-4" />} compact>
            {p.label}
          </NavLink>
        ))}
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
        </header>

        {!loaded ? (
          <div className="py-24 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            {page === "overview" && <OverviewPage data={data} go={go} />}
            {page === "vault" && <VaultPage key={vault?.state} data={data} />}
            {page === "activity" && <ActivityPage data={data} />}
            {page === "companies" && <CompaniesPage data={data} />}
            {page === "data" && <DataPage data={data} />}
            {legalId && <LegalPage id={legalId} go={go} />}
          </>
        )}
      </main>
    </div>
  );
}

function NavLink({
  active,
  onClick,
  icon,
  children,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
        compact ? "shrink-0 px-3 py-1.5" : "w-full px-3 py-2.5",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      {active && !compact && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
      <span className={active ? "text-primary" : ""}>{icon}</span>
      {children}
    </button>
  );
}
