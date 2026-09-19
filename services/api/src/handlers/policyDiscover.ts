// Policy Discover API Handler: finds privacy/terms/deletion policy URLs for a given domain

import { PolicyDiscoverRequestSchema } from "../validation/inputSchemas";
import { discoverPolicyLinks } from "../policy/discoverer";
import type { PolicyDiscoverResponse } from "@consent-ahead/shared-types";

export async function handler(event: { body?: string }) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const parsed = PolicyDiscoverRequestSchema.parse(body);

    const pageUrl = parsed.pageUrl || `https://${parsed.domain}`;
    const discovered = await discoverPolicyLinks(
      parsed.domain,
      pageUrl,
      parsed.pageHtml
    );

    const responseBody: PolicyDiscoverResponse = {
      privacyPolicy: discovered.privacyUrl ? { url: discovered.privacyUrl } : null,
      terms: discovered.termsUrl ? { url: discovered.termsUrl } : null,
      deletion: discovered.deletionUrl ? { url: discovered.deletionUrl } : null,
      dataRequest: discovered.dataRequestUrl ? { url: discovered.dataRequestUrl } : null,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(responseBody),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
}
