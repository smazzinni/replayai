// Shared helpers for the docs experience.

/** URL-safe slug from a heading string. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Extract h2/h3 headings from markdown for the On-this-page TOC. */
export function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = markdown.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h2 = /^(?:##)\s+(.+?)\s*$/.exec(line);
    const h3 = /^(?:###)\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const text = stripMd(h2[1]);
      entries.push({ id: slugify(text), text, level: 2 });
    } else if (h3) {
      const text = stripMd(h3[1]);
      entries.push({ id: slugify(text), text, level: 3 });
    }
  }
  return entries;
}

function stripMd(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
