import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Database, History, LayoutDashboard, Lock, ShieldCheck } from "lucide-react";
import { getAllCompanies, getAllDisclosureEvents, getVaultState } from "../vault/vaultStore";
import { cn } from "../lib/utils";
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
  { id: "companies", label: "Companies", icon: Building2, title: "Companies", description: "Who has your data — and how to take it back" },
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

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: string) => {
    window.location.hash = `/${id}`;
  };

  const summary = useMemo(() => summarize(events), [events]);
  const data: DashData = { vault, events, companies, summary, reload };
  const legalId = page === "privacy" || page === "terms" ? page : null;
  const current = legalId
    ? { title: LEGAL_DOCS[legalId].title, description: LEGAL_DESCRIPTIONS[legalId] }
    : (PAGES.find((p) => p.id === page) ?? PAGES[0]);
  const version = chrome.runtime.getManifest().version;

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
