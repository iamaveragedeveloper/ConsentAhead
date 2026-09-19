// Policy text chunker: breaks long policy text into coherent sections for LLM context window
// Preserves section headers and context overlap.

export interface PolicyChunk {
  index: number;
  header: string;
  text: string;
  charCount: number;
}

const DEFAULT_MAX_CHUNK_SIZE = 4000; // ~1000 tokens per chunk
const OVERLAP_SIZE = 300;

export function chunkPolicyText(
  policyText: string,
  maxChunkSize: number = DEFAULT_MAX_CHUNK_SIZE
): PolicyChunk[] {
  if (!policyText || policyText.length === 0) {
    return [];
  }

  // Split by headers (lines starting with ## or ###)
  const sections = policyText.split(/(?=\n##\s)/g);
  const chunks: PolicyChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Extract header line if present
    const headerMatch = trimmed.match(/^##+\s+(.+)$/m);
    const header = headerMatch ? headerMatch[1].trim() : `Section ${chunkIndex + 1}`;

    if (trimmed.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        header,
        text: trimmed,
        charCount: trimmed.length,
      });
    } else {
      // Sub-chunk large sections by paragraphs
      const paragraphs = trimmed.split(/\n\n+/);
      let currentChunkText = "";

      for (const paragraph of paragraphs) {
        if (currentChunkText.length + paragraph.length > maxChunkSize && currentChunkText.length > 0) {
          chunks.push({
            index: chunkIndex++,
            header: `${header} (Part ${chunks.length + 1})`,
            text: currentChunkText.trim(),
            charCount: currentChunkText.length,
          });

          // Carry over overlap text
          const words = currentChunkText.split(/\s+/);
          const overlapWords = words.slice(-Math.min(words.length, 50));
          currentChunkText = overlapWords.join(" ") + "\n\n" + paragraph;
        } else {
          currentChunkText += (currentChunkText ? "\n\n" : "") + paragraph;
        }
      }

      if (currentChunkText.trim().length > 0) {
        chunks.push({
          index: chunkIndex++,
          header: `${header} (Part ${chunks.length + 1})`,
          text: currentChunkText.trim(),
          charCount: currentChunkText.length,
        });
      }
    }
  }

  return chunks;
}
