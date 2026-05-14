import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../../types/catalog.js";
import { collectDependencyInvalidItemIds, validateCatalogDependencies } from "../dependency-graph.js";

function item(id: string, type: CatalogItem["type"], extra: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    type,
    name: id,
    description: `${id} description`,
    version: "1.0.0",
    source: { adapter: "test", url: "https://example.com", locator: id },
    trust: { tier: "verified", source: "test" },
    status: "active",
    addedAt: "2026-05-14T00:00:00.000Z",
    category: "engineering",
    tags: [],
    ...extra,
  };
}

describe("validateCatalogDependencies", () => {
  it("passes valid multi-dependency agent requirements", () => {
    const result = validateCatalogDependencies([
      item("skill:test/docs", "skill"),
      item("plugin:test/issues", "plugin"),
      item("agent:test/triager", "agent", {
        requires: [
          { type: "skill", id: "skill:test/docs" },
          { type: "plugin", id: "plugin:test/issues", versionRange: "^1.0.0" },
        ],
      }),
    ]);

    expect(result.failuresByItemId.size).toBe(0);
  });

  it("fails missing dependencies", () => {
    const result = validateCatalogDependencies([
      item("agent:test/triager", "agent", {
        requires: [{ type: "skill", id: "skill:test/missing" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("Required catalog item not found");
  });

  it("fails dependency type mismatches", () => {
    const result = validateCatalogDependencies([
      item("plugin:test/issues", "plugin"),
      item("agent:test/triager", "agent", {
        requires: [{ type: "skill", id: "plugin:test/issues" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("type mismatch");
  });

  it("fails invalid semver ranges", () => {
    const result = validateCatalogDependencies([
      item("plugin:test/issues", "plugin"),
      item("agent:test/triager", "agent", {
        requires: [{ type: "plugin", id: "plugin:test/issues", versionRange: "not a range" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("invalid versionRange");
  });

  it("fails unsatisfied semver ranges", () => {
    const result = validateCatalogDependencies([
      item("plugin:test/issues", "plugin", { version: "1.0.0" }),
      item("agent:test/triager", "agent", {
        requires: [{ type: "plugin", id: "plugin:test/issues", versionRange: "^2.0.0" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("does not satisfy");
  });

  it("fails duplicate dependency IDs on the same item", () => {
    const result = validateCatalogDependencies([
      item("skill:test/docs", "skill"),
      item("agent:test/triager", "agent", {
        requires: [
          { type: "skill", id: "skill:test/docs" },
          { type: "skill", id: "skill:test/docs" },
        ],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("duplicate dependency");
  });

  it("fails dependency cycles", () => {
    const result = validateCatalogDependencies([
      item("agent:test/a", "agent", { requires: [{ type: "agent", id: "agent:test/b" }] }),
      item("agent:test/b", "agent", { requires: [{ type: "agent", id: "agent:test/a" }] }),
    ]);

    expect(result.failuresByItemId.get("agent:test/a")?.join(" ")).toContain("cycle");
    expect(result.failuresByItemId.get("agent:test/b")?.join(" ")).toContain("cycle");
  });
});

describe("collectDependencyInvalidItemIds", () => {
  it("cascades dependency rejection to transitive dependents", () => {
    const result = collectDependencyInvalidItemIds([
      item("agent:test/bad", "agent", {
        requires: [{ type: "skill", id: "skill:test/missing" }],
      }),
      item("agent:test/dependent", "agent", {
        requires: [{ type: "agent", id: "agent:test/bad" }],
      }),
      item("agent:test/transitive", "agent", {
        requires: [{ type: "agent", id: "agent:test/dependent" }],
      }),
    ]);

    expect(result.invalidIds).toEqual(
      new Set(["agent:test/bad", "agent:test/dependent", "agent:test/transitive"]),
    );
    expect(result.failuresByItemId.get("agent:test/dependent")?.join(" ")).toContain(
      "dependency agent:test/bad was rejected",
    );
    expect(result.failuresByItemId.get("agent:test/transitive")?.join(" ")).toContain(
      "dependency agent:test/dependent was rejected",
    );
  });
});
