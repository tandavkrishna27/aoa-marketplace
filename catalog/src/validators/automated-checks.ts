import semver from "semver";
import type { CatalogItem } from "../types/catalog.js";
import { CatalogItemSchema } from "../types/catalog.js";

const ALLOWED_LICENSES = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
  "ISC", "MPL-2.0", "Unlicense", "CC0-1.0",
]);

export interface CheckResult {
  itemId: string;
  passed: boolean;
  failures: string[];
  warnings: string[];
}

export function runAutomatedChecks(item: CatalogItem, rawManifest?: Record<string, unknown>): CheckResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // 1. Schema (handled by Zod parse upstream — re-verify)
  const parsed = CatalogItemSchema.safeParse(item);
  if (!parsed.success) {
    failures.push(`Schema invalid: ${parsed.error.message}`);
  }

  // 2. Version is parseable semver
  if (!semver.valid(item.version)) {
    failures.push(`version "${item.version}" is not valid semver`);
  }

  // 3. Capability descriptions present (Plugins only)
  if (item.type === "plugin") {
    if (!item.capabilities || item.capabilities.length === 0) {
      warnings.push("Plugin declares no capabilities — at minimum should declare what it can do");
    }
    for (const cap of item.capabilities ?? []) {
      if (!cap.description || cap.description.trim().length < 10) {
        failures.push(`Capability "${cap.id}" missing or too-short human-readable description`);
      }
    }
  }

  // 4. License field on allowed list (from rawManifest if provided)
  if (rawManifest !== undefined) {
    if (typeof rawManifest.license === "string") {
      if (!ALLOWED_LICENSES.has(rawManifest.license)) {
        failures.push(`license "${rawManifest.license}" not on allowed list`);
      }
    } else {
      warnings.push("No license field in manifest");
    }
  }

  // 5. Source URL present and looks valid
  try {
    new URL(item.source.url);
  } catch {
    failures.push(`source.url "${item.source.url}" is not a valid URL`);
  }

  // 6. Anti-pattern check: no eval-of-remote-content phrases in description
  const ANTI_PATTERNS = [/eval\s*\(/, /exec\s*\(.+http/];
  for (const pattern of ANTI_PATTERNS) {
    if (pattern.test(item.description)) {
      warnings.push(`Description contains potential anti-pattern: ${pattern}`);
    }
  }

  return {
    itemId: item.id,
    passed: failures.length === 0,
    failures,
    warnings,
  };
}
