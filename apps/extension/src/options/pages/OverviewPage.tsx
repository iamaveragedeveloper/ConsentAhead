import React from "react";
import { Activity, Building2, FileText, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Donut, Timeline } from "../charts";
import { timeAgo } from "../lib";
import type { DashData } from "../types";

export function OverviewPage({ data, go }: { data: DashData; go: (page: string) => void }) {
  const { summary: s, events } = data;

  if (events.length === 0) return <Welcome data={data} go={go} />;

  const recent = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
  const maxFields = Math.max(...s.topCompanies.map((c) => c.fields), 1);

  return (
    <div className="space-y-6">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<Building2 className="h-4 w-4" />} label="Companies" value={s.totalCompanies} hint="have your details" />
        <Stat icon={<Activity className="h-4 w-4" />} label="Disclosures" value={s.totalDisclosures} hint="forms you filled" />
        <Stat icon={<FileText className="h-4 w-4" />} label="Fields shared" value={s.fieldsShared} hint="pieces of information" />
        <Stat
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Sensitive share"
          value={`${s.sensitiveShare}%`}
          hint="of what you shared"
          tone={s.sensitiveShare >= 40 ? "bad" : s.sensitiveShare >= 20 ? "warn" : "good"}
        />
      </div>

      {/* Timeline + sensitivity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Disclosures over time</CardTitle>
            <CardDescription>Forms you filled in the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <Timeline data={s.byDay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How sensitive</CardTitle>
            <CardDescription>Everything you've shared, by risk</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut data={s.bySensitivity} centerValue={s.fieldsShared} centerLabel="fields" size={170} showLegend={false} />
            <ul className="mt-4 space-y-2 text-sm">
              {s.bySensitivity.map((d) => (
                <li key={d.key} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: d.fill }} />
                  <span className="flex-1 text-muted-foreground">{d.name}</span>
                  <span className="font-medium tabular-nums">{d.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Data types + top companies */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What you've shared</CardTitle>
            <CardDescription>Your disclosures by type of data</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut data={s.byCategory} centerValue={s.byCategory.length} centerLabel="data types" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Who has the most</CardTitle>
            <CardDescription>Companies holding the most of your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.topCompanies.map((c) => (
              <button key={c.domain} onClick={() => go("companies")} className="block w-full space-y-1.5 text-left">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{c.domain}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.fields} fields · {c.sensitive} sensitive
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-secondary" style={{ width: `${(c.fields / maxFields) * 100}%`, minWidth: "12%" }}>
                  <div className="h-full bg-emerald-400/80" style={{ width: `${((c.fields - c.sensitive) / c.fields) * 100}%` }} />
                  <div className="h-full bg-red-400" style={{ width: `${(c.sensitive / c.fields) * 100}%` }} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity + how you fill */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Your latest disclosures</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => go("activity")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="divide-y">
            {recent.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold uppercase">
                  {e.domain[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.domain}</p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(e.timestamp)} · {e.fields.length} field{e.fields.length === 1 ? "" : "s"}
                  </p>
                </div>
                {e.fillMode === "minimum" && <Badge variant="success">Minimized</Badge>}
                {e.fields.some((f) => f.sensitivity === "high") && <Badge variant="destructive">Sensitive</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How you fill forms</CardTitle>
            <CardDescription>Required-only fills share the least</CardDescription>
          </CardHeader>
          <CardContent>
            <Donut data={s.byMode} centerValue={`${s.minimizedShare}%`} centerLabel="minimized" />
            <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              {s.minimizedShare >= 60
                ? "Nice work. Most of your forms shared only what was required."
                : "Tip: switch to “Required” in the popup to share only what a site strictly needs."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "bad" ? "text-red-400" : tone === "warn" ? "text-amber-400" : tone === "good" ? "text-emerald-400" : "";
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div>
          <p className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Welcome({ data, go }: { data: DashData; go: (page: string) => void }) {
  const vaultReady = data.vault?.state === "ok";
  const steps = [
    { n: 1, title: "Add your details", text: "Save your info once, encrypted on this device.", done: vaultReady },
    { n: 2, title: "Click into any form field", text: "A shield appears beside it. Press it to review the form.", done: false },
    { n: 3, title: "Fill only what's needed", text: "Check the privacy scan, then fill required fields only.", done: false },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 p-8 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> Nothing tracked yet
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight">Your data footprint will appear here</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Each time you fill a form with Data Firewall, it is recorded here: which company, what kind of data and how
              sensitive it was, so you always know who has what. Only categories are stored, never your actual values.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => go("vault")}>
                <Lock className="h-4 w-4" /> {vaultReady ? "Edit my vault" : "Set up my vault"}
              </Button>
              <Button variant="outline" onClick={() => go("data")}>
                Load sample data
              </Button>
            </div>
          </div>
          <ol className="space-y-3">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-3 rounded-xl border bg-card/60 p-4">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    s.done ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/15 text-primary"
                  }`}
                >
                  {s.done ? "✓" : s.n}
                </span>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
