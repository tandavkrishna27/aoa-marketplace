export interface FrontmatterFields {
  name: string;
  description: string;
  version: string;
}

/** Parse YAML-style frontmatter at the top of a markdown file.
 *  Lifted from anthropic-skills/adapter.ts to be shared across all GitHub-sourced adapters. */
export function parseFrontmatter(content: string, fallbackName: string): FrontmatterFields {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return { name: fallbackName, description: fallbackName, version: "1.0.0" };
  }
  const fm = fmMatch[1];
  const get = (key: string): string | undefined => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
  };
  return {
    name: get("name") ?? fallbackName,
    description: get("description") ?? fallbackName,
    version: get("version") ?? "1.0.0",
  };
}
