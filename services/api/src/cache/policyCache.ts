// Policy analysis cache (DynamoDB)
// Stores ONLY public data: a company's domain, a fingerprint of its public policy text, and the
// findings derived from that text. No user data of any kind is ever written here.
//
// Key: domain (partition) + contentHash (sort). When a company edits its policy the hash changes,
// so the old result is simply never found and the new text is analysed once.
// If POLICY_CACHE_TABLE is not set (local dev) the cache is a no-op.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { PrivacyFinding } from "@consent-ahead/shared-types";

const TABLE = process.env.POLICY_CACHE_TABLE;
const TTL_DAYS = Number(process.env.POLICY_CACHE_TTL_DAYS ?? 30);

const doc = TABLE ? DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }) : null;

export interface CachedAnalysis {
  findings: PrivacyFinding[];
  policyUrl?: string;
  analyzedAt: string;
}

export const normaliseDomain = (domain: string) => domain.trim().toLowerCase().replace(/^www\./, "");

export async function getCachedAnalysis(domain: string, contentHash: string): Promise<CachedAnalysis | null> {
  if (!doc || !TABLE) return null;
  try {
    const res = await doc.send(new GetCommand({ TableName: TABLE, Key: { domain: normaliseDomain(domain), contentHash } }));
    const item = res.Item;
    if (!item) return null;
    // DynamoDB removes expired items lazily, so check the TTL ourselves too
    if (typeof item.ttl === "number" && item.ttl < Math.floor(Date.now() / 1000)) return null;
    return { findings: item.findings, policyUrl: item.policyUrl, analyzedAt: item.analyzedAt };
  } catch (err) {
    console.warn("[cache] read failed, continuing without cache:", (err as Error).name);
    return null;
  }
}

export async function putCachedAnalysis(domain: string, contentHash: string, value: Omit<CachedAnalysis, "analyzedAt">): Promise<void> {
  if (!doc || !TABLE) return;
  try {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          domain: normaliseDomain(domain),
          contentHash,
          findings: value.findings,
          policyUrl: value.policyUrl,
          analyzedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + TTL_DAYS * 86400,
        },
      })
    );
  } catch (err) {
    console.warn("[cache] write failed, continuing:", (err as Error).name);
  }
}
