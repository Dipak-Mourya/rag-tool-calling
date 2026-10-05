export type Chunk = { page: number; content: string };

// Per-page windows so every chunk has exactly one page number (exact citations).
// Overlap keeps a fact that straddles a boundary whole inside at least one chunk.
export function chunkPages(pages: string[], size = 1000, overlap = 150): Chunk[] {
  const out: Chunk[] = [];
  pages.forEach((raw, i) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    for (let start = 0; start < text.length; start += size - overlap) {
      const piece = text.slice(start, start + size).trim();
      if (piece.length >= 30) out.push({ page: i + 1, content: piece });
      if (start + size >= text.length) break;
    }
  });
  return out;
}
