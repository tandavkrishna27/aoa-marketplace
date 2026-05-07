import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrustedSources, resolveTrustTier } from "../trust-resolver.js";
import type { CatalogItem } from "../../types/catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// trust-resolver test is at catalog/src/validators/__tests__/
// monorepo root is up 4 levels
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

const baseItem: CatalogItem = {
  id: "plugin:test/example",
  type: "plugin",
  name: "Test",
  description: "Test plugin description",
  version: "1.0.0",
  source: { adapter: "aoa-curated", url: "https://example.com/test", locator: "test" },
  trust: { tier: "verified", source: "aoa-curated" },
  status: "active",
  addedAt: "2026-04-30T00:00:00.000Z",
  category: "engineering",
  tags: [],
};

const TRUSTED_SOURCES = [
  { adapter: "aoa-curated", tier: "verified" as const, reason: "Hand-curated by AoA team" },
  { adapter: "anthropic-skills", tier: "verified" as const, reason: "Trusted upstream" },
];

describe("resolveTrustTier", () => {
  it("returns item's own tier when reviewer is set (manual review wins)", () => {
    const item: CatalogItem = {
      ...baseItem,
      trust: { tier: "community", source: "some-other", reviewer: "aoa-team", reviewedAt: "2026-04-30T00:00:00.000Z" },
    };
    expect(resolveTrustTier(item, TRUSTED_SOURCES)).toBe("community");
  });

  it("inherits trusted source tier when no reviewer", () => {
    const item: CatalogItem = {
      ...baseItem,
      trust: { tier: "unverified", source: "aoa-curated" }, // wrong tier in source field
      source: { adapter: "aoa-curated", url: "https://example.com", locator: "x" },
    };
    expect(resolveTrustTier(item, TRUSTED_SOURCES)).toBe("verified");
  });

  it("falls back to unverified when source adapter is unknown", () => {
    const item: CatalogItem = {
      ...baseItem,
      trust: { tier: "verified", source: "random-source" }, // claimed verified but not in trusted list
      source: { adapter: "random-source", url: "https://example.com", locator: "x" },
    };
    expect(resolveTrustTier(item, TRUSTED_SOURCES)).toBe("unverified");
  });
});

describe("loadTrustedSources", () => {
  it("reads trusted-sources.json from monorepo root and returns all entries", () => {
    const sources = loadTrustedSources(REPO_ROOT);
    expect(sources).toHaveLength(4);
    expect(sources.find((s) => s.adapter === "aoa-curated")?.tier).toBe("verified");
    expect(sources.find((s) => s.adapter === "anthropic-skills")?.tier).toBe("verified");
    const githubSkillsSources = sources.filter((s) => s.adapter === "github-skills");
    expect(githubSkillsSources).toHaveLength(2);
    expect(githubSkillsSources.every((s) => s.tier === "verified")).toBe(true);
  });
});
