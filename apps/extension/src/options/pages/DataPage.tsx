import React, { useCallback, useEffect, useState } from "react";
import { Download, Globe, Sparkles, Trash2 } from "lucide-react";
import { clearAllVaultData } from "../../vault/vaultStore";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { clearScanCache } from "../../privacy/policyScanner";
import { isSample, loadSampleData, removeSampleData } from "../lib";
import type { DashData } from "../types";

export function DataPage({ data }: { data: DashData }) {
  const [origins, setOrigins] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadOrigins = useCallback(async () => {
    try {
      const all = await chrome.permissions.getAll();
      // Only sites the user granted one by one. Broad patterns (http://*/*, file://) are the
      // page-trigger's built-in match rules, not access anyone approved, so they aren't listed.
      // (Parsed with a pattern, not new URL(): Chrome percent-encodes "*" in hostnames.)
      const isSpecificSite = (o: string) => {
        const host = /^[a-z*]+:\/\/([^/]*)/.exec(o)?.[1] ?? "";
        return host !== "" && host !== "*";
      };
      setOrigins((all.origins ?? []).filter(isSpecificSite));
    } catch {
      setOrigins([]);
    }
  }, []);

  useEffect(() => {
    void loadOrigins();
  }, [loadOrigins]);

  const revoke = async (origin: string) => {
    await chrome.permissions.remove({ origins: [origin] });
    await loadOrigins();
  };

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), disclosures: data.events, companies: data.companies }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-firewall-footprint.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasSample = data.events.some((e) => isSample(e.domain)) || data.companies.some((c) => isSample(c.domain));

  const toggleSample = async () => {
    setBusy(true);
    if (hasSample) await removeSampleData(data.events, data.companies);
    else await loadSampleData();
    await data.reload();
    setBusy(false);
  };

  const wipe = async () => {
    await clearAllVaultData();
    await clearScanCache(); // cached policy findings and the temporary tab note go too
    setConfirming(false);
    await data.reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Site access
          </CardTitle>
          <CardDescription>Sites you've allowed Data Firewall to read. Remove access any time.</CardDescription>
        </CardHeader>
        <CardContent>
          {origins.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No sites have access. You'll be asked the first time you use it on a site.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {origins.map((o) => (
                <li key={o} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-sm">{o.replace("/*", "")}</span>
                  <Button size="sm" variant="outline" onClick={() => revoke(o)}>
                    Remove access
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" /> Export your footprint
          </CardTitle>
          <CardDescription>
            Download {data.events.length} disclosure{data.events.length === 1 ? "" : "s"} and {data.companies.length} compan
            {data.companies.length === 1 ? "y" : "ies"} as a JSON file. Your vault details are not included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={exportData} disabled={data.events.length === 0 && data.companies.length === 0}>
            <Download className="h-4 w-4" /> Download JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Sample data
            {hasSample && <Badge variant="secondary">Loaded</Badge>}
          </CardTitle>
          <CardDescription>
            Fill the dashboard with example companies to see how the charts look. Sample entries use “.example” sites and can be
            removed without touching your real data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={toggleSample} disabled={busy}>
            {hasSample ? "Remove sample data" : "Load sample data"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="h-4 w-4" /> Delete everything
          </CardTitle>
          <CardDescription>
            Permanently removes your vault, all recorded disclosures and company history from this browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirming ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={wipe}>Yes, delete everything</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              Delete all data
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
