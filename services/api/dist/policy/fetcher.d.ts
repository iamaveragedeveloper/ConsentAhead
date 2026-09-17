export interface FetchOptions {
    headOnly?: boolean;
    maxSizeBytes?: number;
    timeoutMs?: number;
}
/**
 * Safely fetches a public URL.
 * Returns HTML/text content, or null if unavailable/blocked.
 */
export declare function safeFetch(url: string, options?: FetchOptions): Promise<string | null>;
export declare function hashContent(content: string): string;
