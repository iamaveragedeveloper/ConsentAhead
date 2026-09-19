// Disclosure Recorder: records what the user chose to share
// Stores categories only, NEVER raw personal values

import { v4 as uuidv4 } from "./uuid";
import {
  saveDisclosureEvent,
  saveCompanyProfile,
  getCompanyProfile,
} from "../vault/vaultStore";
import type {
  DisclosureEvent,
  DisclosureField,
  PrivacyFinding,
  CompanyProfile,
  DataCategory,
} from "@consent-ahead/shared-types";

export interface RecordDisclosureParams {
  domain: string;
  pageUrl: string;
  selectedFields: DisclosureField[];
  findings: PrivacyFinding[];
  fillMode: "minimum" | "full" | "manual";
  policyUrl?: string;
}

export async function recordDisclosure(params: RecordDisclosureParams): Promise<DisclosureEvent> {
  const { domain, pageUrl, selectedFields, findings, fillMode, policyUrl } = params;

  const event: DisclosureEvent = {
    id: uuidv4(),
    domain,
    pageUrl,
    timestamp: new Date().toISOString(),
    // Store categories and sensitivity ONLY, no actual values
    fields: selectedFields.map((f) => ({
      fieldId: f.fieldId,
      category: f.category,
      sensitivity: f.sensitivity,
    })),
    policyFindings: findings.map((f) => f.id),
    findingsSummary: findings,
    userConfirmed: true,
    fillMode,
  };

  await saveDisclosureEvent(event);

  // Update company profile
  const sharedCategories: DataCategory[] = [
    ...new Set(selectedFields.map((f) => f.category)),
  ];

  const existing = await getCompanyProfile(domain);
  const now = new Date().toISOString();

  const company: CompanyProfile = {
    domain,
    firstSeen: existing?.firstSeen ?? now,
    lastInteraction: now,
    sharedCategories: [
      ...new Set([...(existing?.sharedCategories ?? []), ...sharedCategories]),
    ],
    disclosureCount: (existing?.disclosureCount ?? 0) + 1,
    privacyPolicyUrl: policyUrl ?? existing?.privacyPolicyUrl,
    termsUrl: existing?.termsUrl,
    deletionUrl: existing?.deletionUrl,
    dataRequestUrl: existing?.dataRequestUrl,
    pathways: existing?.pathways,
  };

  await saveCompanyProfile(company);

  return event;
}

// ─── Footprint Aggregation ────────────────────────────────────────────────────

export interface FootprintSummary {
  totalCompanies: number;
  totalDisclosures: number;
  sensitiveDisclosures: number;
  categoryBreakdown: { category: DataCategory; count: number; companies: string[] }[];
  recentActivity: DisclosureEvent[];
}

export async function getFootprintSummary(
  events: DisclosureEvent[]
): Promise<FootprintSummary> {
  const companies = new Set(events.map((e) => e.domain));

  const sensitiveDisclosures = events.filter((e) =>
    e.fields.some((f) => f.sensitivity === "high")
  ).length;

  // Category breakdown
  const categoryMap = new Map<DataCategory, Set<string>>();
  for (const event of events) {
    for (const field of event.fields) {
      if (!categoryMap.has(field.category)) {
        categoryMap.set(field.category, new Set());
      }
      categoryMap.get(field.category)!.add(event.domain);
    }
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, domains]) => ({
      category,
      count: domains.size,
      companies: Array.from(domains),
    }))
    .sort((a, b) => b.count - a.count);

  const recentActivity = [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return {
    totalCompanies: companies.size,
    totalDisclosures: events.length,
    sensitiveDisclosures,
    categoryBreakdown,
    recentActivity,
  };
}
