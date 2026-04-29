import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogItem, TrustTier } from "../types/catalog.js";

interface TrustedSource {
  adapter: string;
  tier: TrustTier;
  reason: string;
}

interface TrustedSourcesFile {
  schemaVersion: string;
  trustedSources: TrustedSource[];
}

export function loadTrustedSources(repoRoot: string): TrustedSource[] {
  const path = join(repoRoot, "trusted-sources.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as TrustedSourcesFile;
  return raw.trustedSources;
}

export function resolveTrustTier(
  item: CatalogItem,
  trustedSources: TrustedSource[],
): TrustTier {
  // If item already has explicit reviewer (manual review), keep its tier
  if (item.trust.reviewer) {
    return item.trust.tier;
  }

  // Otherwise inherit from source
  const source = trustedSources.find((s) => s.adapter === item.source.adapter);
  if (source) {
    return source.tier;
  }

  // Unknown source = unverified
  return "unverified";
}
