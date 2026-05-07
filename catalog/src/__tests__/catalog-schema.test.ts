import { describe, expect, it } from "vitest";
import { CatalogItemSchema } from "../types/catalog.js";

describe("CatalogItemSchema runtimeRequires field", () => {
  const baseItem = {
    id: "skill:test/foo/bar",
    type: "skill" as const,
    name: "Test",
    description: "Test desc",
    version: "1.0.0",
    source: { adapter: "test", url: "https://example.com", locator: "x", commitSha: "abc" },
    trust: { tier: "verified" as const, source: "test" },
    status: "active" as const,
    addedAt: "2026-05-07T00:00:00.000Z",
    category: "engineering" as const,
    tags: [],
  };

  it("accepts items without runtimeRequires (backwards compat)", () => {
    expect(() => CatalogItemSchema.parse(baseItem)).not.toThrow();
  });

  it("accepts string array for runtimeRequires", () => {
    const item = { ...baseItem, runtimeRequires: ["gstack-bin", "gbrain"] };
    const parsed = CatalogItemSchema.parse(item);
    expect(parsed.runtimeRequires).toEqual(["gstack-bin", "gbrain"]);
  });

  it("rejects non-string entries in runtimeRequires", () => {
    const item = { ...baseItem, runtimeRequires: [123] };
    expect(() => CatalogItemSchema.parse(item)).toThrow();
  });
});
