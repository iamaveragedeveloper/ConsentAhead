import React, { useMemo, useState } from "react";
import { ExternalLink, Search, Trash2 } from "lucide-react";
import type { CompanyProfile } from "@consent-ahead/shared-types";
import { saveCompanyProfile } from "../../vault/vaultStore";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { CATEGORY_META, SENSITIVITY_META, companyMix, forgetCompany, isSample, timeAgo } from "../lib";
import type { DashData } from "../types";

type Sort = "recent" | "most";

export function CompaniesPage({ data }: { data: DashData }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const rows = useMemo(() => {
    const list = data.companies.filter((c) => c.domain.toLowerCase().includes(query.trim().toLowerCase()));
    return list.sort((a, b) =>
      sort === "recent" ? b.lastInteraction.localeCompare(a.lastInteraction) : b.disclosureCount - a.disclosureCount
    );
  }, [data.companies, query, sort]);

  if (data.companies.length === 0) {
    return (
      <Card className="border-dashed py-16 text-center">
        <p className="text-sm font-medium">No companies yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Sites you fill forms on will show up here, with links to their policy and to delete your data.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search companies…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {([["recent", "Most recent"], ["most", "Most data"]] as [Sort, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sort === k ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map((c) => (
          <CompanyCard key={c.domain} company={c} data={data} />
        ))}
      </div>
    </div>
  );
}

function CompanyCard({ company: c, data }: { company: CompanyProfile; data: DashData }) {
  const mix = companyMix(data.events, c.domain);
  const total = mix.low + mix.medium + mix.high;
  const [editing, setEditing] = useState(false);
  const [deletion, setDeletion] = useState(c.deletionUrl ?? "");
  const [request, setRequest] = useState(c.dataRequestUrl ?? "");
  const [confirming, setConfirming] = useState(false);

  const saveLinks = async () => {
    await saveCompanyProfile({ ...c, deletionUrl: deletion.trim() || undefined, dataRequestUrl: request.trim() || undefined });
    setEditing(false);
    await data.reload();
  };

  const forget = async () => {
    await forgetCompany(c.domain, data.events);
    await data.reload();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-semibold uppercase">
            {c.domain[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{c.name || c.domain}</p>
              {isSample(c.domain) && <Badge variant="secondary">Sample</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {c.disclosureCount} disclosure{c.disclosureCount === 1 ? "" : "s"} · last {timeAgo(c.lastInteraction)}
            </p>
          </div>
        </div>

        {/* What they have, coloured by sensitivity */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
              {(["low", "medium", "high"] as const).map((k) =>
                mix[k] ? <div key={k} style={{ width: `${(mix[k] / total) * 100}%`, backgroundColor: SENSITIVITY_META[k].color }} /> : null
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {(["low", "medium", "high"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SENSITIVITY_META[k].color }} />
                  {mix[k]} {SENSITIVITY_META[k].label.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {c.sharedCategories.map((cat) => (
            <Badge key={cat} variant="secondary">
              {CATEGORY_META[cat].label}
            </Badge>
          ))}
        </div>

        {/* Take your data back */}
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <LinkButton href={c.privacyPolicyUrl}>Privacy policy</LinkButton>
            <LinkButton href={c.termsUrl}>Terms</LinkButton>
            <LinkButton href={c.dataRequestUrl}>Request my data</LinkButton>
            <LinkButton href={c.deletionUrl} destructive>
              Delete my account
            </LinkButton>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setEditing(true)}>
              {c.deletionUrl || c.dataRequestUrl ? "Edit links" : "Add deletion link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <Input placeholder="Account deletion page URL" value={deletion} onChange={(e) => setDeletion(e.target.value)} />
            <Input placeholder="Data request page URL" value={request} onChange={(e) => setRequest(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveLinks}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="border-t pt-3">
          {confirming ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Remove this company from your history?</span>
              <Button size="sm" variant="destructive" className="h-7" onClick={forget}>Remove</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirming(false)}>Keep</Button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400">
              <Trash2 className="h-3 w-3" /> Forget this company
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LinkButton({ href, children, destructive }: { href?: string; children: React.ReactNode; destructive?: boolean }) {
  if (!href) return null;
  return (
    <Button asChild size="sm" variant={destructive ? "destructive" : "outline"}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children} <ExternalLink className="h-3 w-3" />
      </a>
    </Button>
  );
}
