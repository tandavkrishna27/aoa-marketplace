import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OVERRIDES_FILENAME = "skill-overrides.json";

/** Load `<contentRoot>/skill-overrides.json` as a Map<catalogItemId, runtimeRequires>.
 *  Returns an empty Map if the file is missing. Throws on malformed JSON. */
export function loadSkillOverrides(contentRoot: string): Map<string, string[]> {
  const path = join(contentRoot, OVERRIDES_FILENAME);
  if (!existsSync(path)) return new Map();
  const raw = readFileSync(path, "utf-8");
  const obj = JSON.parse(raw) as Record<string, string[]>;
  return new Map(Object.entries(obj));
}

/** Merge frontmatter and override values for runtimeRequires.
 *  Frontmatter takes precedence; override fills in for upstream skills that don't self-declare.
 *  Returns [] when neither has a value. */
export function mergeRuntimeRequires(
  fromFrontmatter: string[] | undefined,
  catalogId: string,
  overrides: Map<string, string[]>,
): string[] {
  if (fromFrontmatter !== undefined) return fromFrontmatter;
  return overrides.get(catalogId) ?? [];
}
