export interface FrontmatterFields {
  name: string;
  description: string;
  version: string;
  category?: string;
  tags?: string[];
  runtimeRequires?: string[];
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  raw: Record<string, unknown>;
}

/** Parse YAML-style frontmatter at the top of a markdown file.
 *  Supports inline-list syntax for `tags` and `runtimeRequires`: `tags: [a, b, c]` */
export function parseFrontmatter(content: string, fallbackName: string): FrontmatterFields {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return { name: fallbackName, description: fallbackName, version: "1.0.0", raw: {} };
  }
  const fm = fmMatch[1];
  const raw: Record<string, unknown> = {};
  const values = new Map<string, string>();
  const lines = fm.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s/.test(line)) continue;

    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1].trim();
    const value = match[2].trim();

    if (key === "metadata" && value === "") {
      const metadata: Record<string, string> = {};
      for (let j = i + 1; j < lines.length; j += 1) {
        const metadataLine = lines[j];
        if (!/^\s+/.test(metadataLine)) break;

        const metadataMatch = metadataLine.trim().match(/^([^:]+):\s*(.+)$/);
        if (metadataMatch) {
          metadata[metadataMatch[1].trim()] = stripQuotes(metadataMatch[2].trim());
        }
        i = j;
      }
      raw.metadata = metadata;
      continue;
    }

    if (value !== "") {
      const parsedValue = stripQuotes(value);
      values.set(key, parsedValue);
      raw[key] = parsedValue;
    }
  }

  const get = (key: string): string | undefined => values.get(key);
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
    license: get("license"),
    compatibility: get("compatibility"),
    metadata: raw.metadata as Record<string, string> | undefined,
    allowedTools: get("allowed-tools"),
    userInvocable: parseBoolean(get("user-invocable")),
    disableModelInvocation: parseBoolean(get("disable-model-invocation")),
    raw,
  };
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}
