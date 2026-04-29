import { describe, it, expect } from "vitest";
import { runAutomatedChecks } from "../automated-checks.js";
import type { CatalogItem } from "../../types/catalog.js";

const baseItem: CatalogItem = {
  id: "plugin:test/example",
  type: "plugin",
  name: "Test Plugin",
  description: "A test plugin for unit tests",
  version: "1.0.0",
  source: { adapter: "aoa-curated", url: "https://example.com/test", locator: "test" },
  trust: { tier: "verified", source: "aoa-curated" },
  status: "active",
  addedAt: "2026-04-30T00:00:00.000Z",
  category: "engineering",
  tags: [],
  capabilities: [{ id: "test_cap", description: "Test capability description here" }],
};

describe("runAutomatedChecks", () => {
  it("passes a valid plugin", () => {
    const result = runAutomatedChecks(baseItem, { license: "MIT" });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails on invalid semver", () => {
    const item = { ...baseItem, version: "not-semver" };
    const result = runAutomatedChecks(item);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("semver"))).toBe(true);
  });

  it("fails on too-short capability description", () => {
    const item = {
      ...baseItem,
      capabilities: [{ id: "x", description: "short" }],
    };
    const result = runAutomatedChecks(item);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("description"))).toBe(true);
  });

  it("fails on disallowed license", () => {
    const result = runAutomatedChecks(baseItem, { license: "Proprietary" });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("license"))).toBe(true);
  });

  it("warns on missing capabilities for plugin", () => {
    const item = { ...baseItem, capabilities: [] };
    const result = runAutomatedChecks(item);
    expect(result.warnings.some((w) => w.includes("capabilities"))).toBe(true);
  });

  it("fails on invalid source URL", () => {
    const item = { ...baseItem, source: { ...baseItem.source, url: "not a url" } };
    const result = runAutomatedChecks(item);
    expect(result.passed).toBe(false);
  });
});
