// Policy text extractor — converts HTML to structured, clean text
// Preserves headings, sections, and structural markers for AI context.

export interface ExtractedPolicy {
  text: string;
  headings: string[];
  charCount: number;
}

export function extractTextFromHtml(html: string): ExtractedPolicy {
  const headings: string[] = [];

  // Remove script, style, SVG, nav, footer tags
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Extract headings (h1, h2, h3, h4)
  const headingMatches = cleaned.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi);
  if (headingMatches) {
    for (const match of headingMatches) {
      const text = match.replace(/<[^>]+>/g, "").trim();
      if (text.length > 2) {
        headings.push(text);
      }
    }
  }

  // Replace heading tags with line breaks and markdown headers
  cleaned = cleaned.replace(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/gi, "\n\n## $1\n\n");
  cleaned = cleaned.replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, "\n\n### $1\n\n");

  // Replace paragraph and block elements with double line breaks
  cleaned = cleaned.replace(/<\/(p|div|section|article|li|tr)>/gi, "\n\n");

  // Replace br tags with single line breaks
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // Strip all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&copy;/gi, "(c)")
    .replace(/&reg;/gi, "(R)");

  // Normalize whitespace (keep line breaks, condense multiple spaces/newlines)
  const text = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return {
    text,
    headings,
    charCount: text.length,
  };
}
