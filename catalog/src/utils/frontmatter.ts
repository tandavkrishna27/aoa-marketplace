export interface FrontmatterFields {
  name: string;
  description: string;
  version: string;
  category?: string;
  tags?: string[];
  runtimeRequires?: string[];
}

/** Parse YAML-style frontmatter at the top of a markdown file.
 *  Supports inline-list syntax for `tags` and `runtimeRequires`: `tags: [a, b, c]` */
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
  const getList = (key: string): string[] | undefined => {
    const raw = get(key);
    if (!raw) return undefined;
    // Inline-list syntax: [a, b, c]
    const inline = raw.match(/^\[(.+)\]$/);
    if (inline) {
      return inline[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    // Single value treated as one-element list
    return [raw];
  };
  return {
    name: get("name") ?? fallbackName,
    description: get("description") ?? fallbackName,
    version: get("version") ?? "1.0.0",
    category: get("category"),
    tags: getList("tags"),
    runtimeRequires: getList("runtimeRequires"),
  };
}
