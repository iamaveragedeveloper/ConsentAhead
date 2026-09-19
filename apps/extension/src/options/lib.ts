import type { CompanyProfile, DataCategory, DisclosureEvent, Sensitivity } from "@consent-ahead/shared-types";
import { saveCompanyProfile, saveDisclosureEvent, deleteCompanyProfile, deleteDisclosureEvent } from "../vault/vaultStore";

// ── Colour + label metadata ──────────────────────────────────────────────────

export const CATEGORY_META: Record<DataCategory, { label: string; color: string }> = {
  contact: { label: "Contact", color: "#818cf8" },
  basic_personal: { label: "Basic info", color: "#a78bfa" },
  location: { label: "Location", color: "#22d3ee" },
  identity: { label: "Identity", color: "#f87171" },
  financial: { label: "Financial", color: "#fbbf24" },
  professional: { label: "Professional", color: "#34d399" },
  health: { label: "Health", color: "#f472b6" },
  sensitive_other: { label: "Sensitive", color: "#fb923c" },
  consent: { label: "Consent", color: "#c084fc" },
  unknown: { label: "Other", color: "#71717a" },
};

export const SENSITIVITY_META: Record<Sensitivity, { label: string; color: string }> = {
  low: { label: "Low", color: "#34d399" },
  medium: { label: "Medium", color: "#fbbf24" },
  high: { label: "Sensitive", color: "#f87171" },
  unknown: { label: "Unknown", color: "#71717a" },
};

// ── Aggregation for the charts ───────────────────────────────────────────────

export interface Summary {
  totalDisclosures: number;
  totalCompanies: number;
  fieldsShared: number;
  sensitiveFields: number;
  sensitiveShare: number; // 0-100
  minimizedShare: number; // 0-100
  byCategory: { key: DataCategory; name: string; value: number; fill: string }[];
  bySensitivity: { key: Sensitivity; name: string; value: number; fill: string }[];
  byMode: { key: string; name: string; value: number; fill: string }[];
  byDay: { date: string; label: string; disclosures: number }[];
  topCompanies: { domain: string; count: number; fields: number; sensitive: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function summarize(events: DisclosureEvent[], days = 14): Summary {
  const categories = new Map<DataCategory, number>();
  const sensitivities = new Map<Sensitivity, number>();
  const companies = new Map<string, { count: number; fields: number; sensitive: number }>();
  let fieldsShared = 0;
  let minimized = 0;

  for (const e of events) {
    if (e.fillMode === "minimum") minimized++;
    const c = companies.get(e.domain) ?? { count: 0, fields: 0, sensitive: 0 };
    c.count++;
    for (const f of e.fields) {
      fieldsShared++;
      c.fields++;
      if (f.sensitivity === "high") c.sensitive++;
      categories.set(f.category, (categories.get(f.category) ?? 0) + 1);
      sensitivities.set(f.sensitivity, (sensitivities.get(f.sensitivity) ?? 0) + 1);
    }
    companies.set(e.domain, c);
  }

  // Disclosures per day for the last `days` days (including empty days, so the chart has a shape)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byDay = Array.from({ length: days }, (_, i) => {
    const start = today.getTime() - (days - 1 - i) * DAY_MS;
    const d = new Date(start);
    const count = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t < start + DAY_MS;
    }).length;
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), disclosures: count };
  });

  const sensitiveFields = sensitivities.get("high") ?? 0;
  const full = events.length - minimized;

  return {
    totalDisclosures: events.length,
    totalCompanies: companies.size,
    fieldsShared,
    sensitiveFields,
    sensitiveShare: fieldsShared ? Math.round((sensitiveFields / fieldsShared) * 100) : 0,
    minimizedShare: events.length ? Math.round((minimized / events.length) * 100) : 0,
    byCategory: [...categories.entries()]
      .map(([key, value]) => ({ key, name: CATEGORY_META[key].label, value, fill: CATEGORY_META[key].color }))
      .sort((a, b) => b.value - a.value),
    bySensitivity: (["low", "medium", "high"] as Sensitivity[])
      .filter((k) => sensitivities.has(k))
      .map((key) => ({ key, name: SENSITIVITY_META[key].label, value: sensitivities.get(key) ?? 0, fill: SENSITIVITY_META[key].color })),
    byMode: [
      { key: "minimum", name: "Required only", value: minimized, fill: "#34d399" },
      { key: "full", name: "All fields", value: full, fill: "#818cf8" },
    ].filter((m) => m.value > 0),
    byDay,
    topCompanies: [...companies.entries()]
      .map(([domain, v]) => ({ domain, ...v }))
      .sort((a, b) => b.count - a.count || b.fields - a.fields)
      .slice(0, 6),
  };
}

// Sensitivity mix for one company (used by the Companies page)
export function companyMix(events: DisclosureEvent[], domain: string) {
  const mix = { low: 0, medium: 0, high: 0 };
  for (const e of events) {
    if (e.domain !== domain) continue;
    for (const f of e.fields) if (f.sensitivity in mix) mix[f.sensitivity as keyof typeof mix]++;
  }
  return mix;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** Removes a company and everything recorded about it. */
export async function forgetCompany(domain: string, events: DisclosureEvent[]): Promise<void> {
  await Promise.all(events.filter((e) => e.domain === domain).map((e) => deleteDisclosureEvent(e.id)));
  await deleteCompanyProfile(domain);
}

// ── Sample data (for demos) ──────────────────────────────────────────────────
// Demo companies use the reserved ".example" suffix so they can be removed cleanly.

export const isSample = (domain: string) => domain.endsWith(".example");

const SAMPLE = [
  { domain: "shopnest.example", days: [1, 4, 9], mode: "full", cats: ["basic_personal", "contact", "location", "financial"] },
  { domain: "jobboard.example", days: [2, 3], mode: "minimum", cats: ["basic_personal", "contact", "professional"] },
  { domain: "eventify.example", days: [0, 6], mode: "minimum", cats: ["basic_personal", "contact"] },
  { domain: "fitpulse.example", days: [5, 11], mode: "full", cats: ["basic_personal", "contact", "health", "identity"] },
  { domain: "learnhub.example", days: [7], mode: "minimum", cats: ["basic_personal", "contact", "professional"] },
  { domain: "travelgo.example", days: [3, 12], mode: "full", cats: ["basic_personal", "contact", "identity", "location"] },
] as const;

const SENS: Record<string, Sensitivity> = {
  basic_personal: "low", contact: "medium", location: "high", identity: "high",
  financial: "high", professional: "low", health: "high", consent: "low",
};

export async function loadSampleData(): Promise<void> {
  let n = 0;
  for (const c of SAMPLE) {
    for (const daysAgo of c.days) {
      const ts = new Date(Date.now() - daysAgo * DAY_MS - (n % 5) * 3600_000).toISOString();
      const fields = (c.mode === "minimum" ? c.cats.slice(0, 2) : c.cats).map((category, i) => ({
        fieldId: `${category}-${i}`,
        category: category as DataCategory,
        sensitivity: SENS[category] ?? "low",
      }));
      await saveDisclosureEvent({
        id: `demo-${c.domain}-${daysAgo}`,
        domain: c.domain,
        pageUrl: c.domain,
        timestamp: ts,
        fields,
        policyFindings: [],
        findingsSummary: [],
        userConfirmed: true,
        fillMode: c.mode,
      });
      n++;
    }
    const last = Math.min(...c.days);
    const company: CompanyProfile = {
      domain: c.domain,
      firstSeen: new Date(Date.now() - Math.max(...c.days) * DAY_MS).toISOString(),
      lastInteraction: new Date(Date.now() - last * DAY_MS).toISOString(),
      sharedCategories: [...c.cats] as DataCategory[],
      disclosureCount: c.days.length,
      privacyPolicyUrl: `https://${c.domain}/privacy`,
      termsUrl: `https://${c.domain}/terms`,
      deletionUrl: c.mode === "full" ? `https://${c.domain}/account/delete` : undefined,
      dataRequestUrl: c.mode === "full" ? `https://${c.domain}/privacy/request` : undefined,
    };
    await saveCompanyProfile(company);
  }
}

export async function removeSampleData(events: DisclosureEvent[], companies: CompanyProfile[]): Promise<void> {
  await Promise.all(events.filter((e) => isSample(e.domain)).map((e) => deleteDisclosureEvent(e.id)));
  await Promise.all(companies.filter((c) => isSample(c.domain)).map((c) => deleteCompanyProfile(c.domain)));
}
