import React, { useMemo, useState } from "react";
import { ChevronDown, Search, Trash2 } from "lucide-react";
import type { DisclosureEvent } from "@consent-ahead/shared-types";
import { deleteDisclosureEvent } from "../../vault/vaultStore";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { CATEGORY_META, SENSITIVITY_META, timeAgo } from "../lib";
import type { DashData } from "../types";

type Filter = "all" | "sensitive" | "minimized";

export function ActivityPage({ data }: { data: DashData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    return [...data.events]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .filter((e) => e.domain.toLowerCase().includes(query.trim().toLowerCase()))
      .filter((e) =>
        filter === "sensitive" ? e.fields.some((f) => f.sensitivity === "high") : filter === "minimized" ? e.fillMode === "minimum" : true
      );
  }, [data.events, query, filter]);

  const remove = async (id: string) => {
    await deleteDisclosureEvent(id);
    await data.reload();
  };

  if (data.events.length === 0) {
    return (
      <Card className="border-dashed py-16 text-center">
        <p className="text-sm font-medium">No activity yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Forms you fill with Data Firewall will be listed here, newest first.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by site…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {(["all", "sensitive", "minimized"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {rows.length} of {data.events.length} disclosure{data.events.length === 1 ? "" : "s"}
      </p>

      <Card className="divide-y overflow-hidden">
        {rows.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing matches your filters.</p>}
        {rows.map((e) => (
          <Row key={e.id} event={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} onDelete={() => remove(e.id)} />
        ))}
      </Card>
    </div>
  );
}

function Row({ event: e, open, onToggle, onDelete }: { event: DisclosureEvent; open: boolean; onToggle: () => void; onDelete: () => void }) {
  const sensitive = e.fields.filter((f) => f.sensitivity === "high").length;
  const categories = [...new Set(e.fields.map((f) => f.category))];

  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent/40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-semibold uppercase">
          {e.domain[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{e.domain}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(e.timestamp).toLocaleString()} · {timeAgo(e.timestamp)}
          </p>
        </div>
        <div className="hidden flex-wrap justify-end gap-1.5 md:flex">
          {categories.slice(0, 3).map((c) => (
            <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {CATEGORY_META[c].label}
            </span>
          ))}
          {categories.length > 3 && <span className="text-[11px] text-muted-foreground">+{categories.length - 3}</span>}
        </div>
        <div className="flex w-[150px] shrink-0 justify-end gap-1.5">
          {e.fillMode === "minimum" && <Badge variant="success">Minimized</Badge>}
          {sensitive > 0 && <Badge variant="destructive">{sensitive} sensitive</Badge>}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t bg-muted/30 px-4 py-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Shared {e.fields.length} field{e.fields.length === 1 ? "" : "s"} · {e.fillMode === "minimum" ? "required fields only" : "all fields"}
            </p>
            <div className="flex flex-wrap gap-2">
              {e.fields.map((f, i) => (
                <span key={`${f.fieldId}-${i}`} className="inline-flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SENSITIVITY_META[f.sensitivity].color }} />
                  {CATEGORY_META[f.category].label}
                  <span className="text-muted-foreground">· {SENSITIVITY_META[f.sensitivity].label}</span>
                </span>
              ))}
            </div>
          </div>

          {e.findingsSummary.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Policy notes at the time</p>
              <ul className="space-y-1 text-sm">
                {e.findingsSummary.map((f) => (
                  <li key={f.id} className="text-muted-foreground">• {f.claim}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Only categories are stored, never the values you filled in.</p>
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Delete this record
          </Button>
        </div>
      )}
    </div>
  );
}
