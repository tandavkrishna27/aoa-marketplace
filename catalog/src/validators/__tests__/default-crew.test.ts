import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../../types/catalog.js";
import {
  assertDefaultCrewCatalogInvariant,
  validateDefaultCrewSource,
} from "../default-crew.js";

const STEWARD_ID = "agent:aoa-curated/aoa-steward";
const TEAM_ID = "team:aoa-curated/default-crew";

function validSource() {
  return {
    stewardManifest: { id: STEWARD_ID },
    teamManifest: {
      id: TEAM_ID,
      requires: [{ type: "agent", id: STEWARD_ID }],
    },
    teamBody: {
      manifest: { installOrder: ["scout", "steward"] },
      agents: [{ templateOrigin: STEWARD_ID, name: "Steward" }],
    },
  };
}

function catalogItem(id: string, type: CatalogItem["type"]): CatalogItem {
  return {
    id,
    type,
    name: id,
    description: `${id} fixture`,
    version: "1.0.0",
    source: { adapter: "aoa-curated", url: "https://example.test", locator: id },
    trust: { tier: "verified", source: "aoa-curated" },
    status: "active",
    addedAt: "2026-07-27T00:00:00.000Z",
    category: "workflows",
    tags: [],
  };
}

function validCatalog(): CatalogItem[] {
  return [
    catalogItem(STEWARD_ID, "agent"),
    {
      ...catalogItem(TEAM_ID, "team"),
      requires: [{ type: "agent", id: STEWARD_ID }],
    },
  ];
}

describe("validateDefaultCrewSource", () => {
  it("accepts the protected Steward relationship in all source representations", () => {
    expect(validateDefaultCrewSource(validSource())).toEqual([]);
  });

  it("requires the canonical Steward package", () => {
    const source = validSource();
    source.stewardManifest.id = "agent:aoa-curated/not-steward";
    expect(validateDefaultCrewSource(source)).toContain(
      `Steward manifest id must be ${STEWARD_ID}`,
    );
  });

  it.each(["manifest requires", "team body"] as const)(
    "requires Steward exactly once in %s",
    (representation) => {
      const missing = validSource();
      const missingValues =
        representation === "manifest requires"
          ? missing.teamManifest.requires
          : missing.teamBody.agents;
      missingValues.splice(0);
      expect(validateDefaultCrewSource(missing).join(" ")).toMatch(/exactly once/i);

      const duplicate = validSource();
      if (representation === "manifest requires") {
        duplicate.teamManifest.requires.push({ ...duplicate.teamManifest.requires[0] });
      } else {
        duplicate.teamBody.agents.push({ ...duplicate.teamBody.agents[0] });
      }
      expect(validateDefaultCrewSource(duplicate).join(" ")).toMatch(/exactly once/i);
    },
  );

  it("requires the manifest dependency to have type agent", () => {
    const source = validSource();
    source.teamManifest.requires[0].type = "skill";
    expect(validateDefaultCrewSource(source).join(" ")).toMatch(/agent dependency/i);
  });

  it("requires Steward exactly once in installOrder", () => {
    const missing = validSource();
    missing.teamBody.manifest.installOrder = ["scout"];
    expect(validateDefaultCrewSource(missing).join(" ")).toMatch(/installOrder.*exactly once/i);

    const duplicate = validSource();
    duplicate.teamBody.manifest.installOrder.push("steward");
    expect(validateDefaultCrewSource(duplicate).join(" ")).toMatch(/installOrder.*exactly once/i);
  });
});

describe("assertDefaultCrewCatalogInvariant", () => {
  it("accepts the active aggregated Steward/default-crew relationship", () => {
    expect(() => assertDefaultCrewCatalogInvariant(validCatalog())).not.toThrow();
  });

  it("fails publication when Steward was rejected from the catalog", () => {
    expect(() => assertDefaultCrewCatalogInvariant(validCatalog().slice(1))).toThrow(
      /active Steward/i,
    );
  });

  it("fails publication when default-crew no longer requires Steward", () => {
    const items = validCatalog();
    items[1] = { ...items[1], requires: [] };
    expect(() => assertDefaultCrewCatalogInvariant(items)).toThrow(/require Steward/i);
  });
});
