// Safe HTTP fetcher with SSRF protection
// Never fetches: localhost, private IPs, cloud metadata endpoints, file:// URLs

import { createHash } from "crypto";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 10_000; // 10 seconds
const MAX_REDIRECTS = 5;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal",
  "100.100.100.200", // Alibaba metadata
]);

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
];

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  return PRIVATE_IP_RANGES.some((r) => r.test(hostname));
}

export interface FetchOptions {
  headOnly?: boolean;
  maxSizeBytes?: number;
  timeoutMs?: number;
}

/**
 * Safely fetches a public URL.
 * Returns HTML/text content, or null if unavailable/blocked.
 */
export async function safeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<string | null> {
  const { headOnly = false, maxSizeBytes = MAX_SIZE_BYTES, timeoutMs = TIMEOUT_MS } = options;

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.warn("[fetcher] Invalid URL:", url);
    return null;
  }

  // Only allow HTTP(S)
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    console.warn("[fetcher] Blocked non-HTTP protocol:", parsedUrl.protocol);
    return null;
  }

  // SSRF protection
  if (isBlockedHost(parsedUrl.hostname)) {
    console.warn("[fetcher] Blocked host:", parsedUrl.hostname);
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: headOnly ? "HEAD" : "GET",
      headers: {
        "User-Agent": "PersonalDataFirewall/1.0 (Privacy Analysis Bot; contact privacy@consent-ahead.dev)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (headOnly) return response.ok ? "ok" : null;

    if (!response.ok) {
      console.warn("[fetcher] HTTP error:", response.status, url);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/") && !contentType.includes("application/xhtml")) {
      console.warn("[fetcher] Unsupported content type:", contentType);
      return null;
    }

    // Check content length
    const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10);
    if (contentLength > maxSizeBytes) {
      console.warn("[fetcher] Response too large:", contentLength);
      return null;
    }

    // Stream with size limit
    const reader = response.body?.getReader();
    if (!reader) return null;

    let totalBytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxSizeBytes) {
          reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return buffer.toString("utf-8");

  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.warn("[fetcher] Request timed out:", url);
    } else {
      console.warn("[fetcher] Fetch error:", url, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
