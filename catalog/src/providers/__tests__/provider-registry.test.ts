import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProviderRegistry, resolveProviderForItem } from "../provider-registry.js";
import type { CatalogItem } from "../../types/catalog.js";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("loadProviderRegistry", () => {
  it("loads provider entries from content/providers.json", () => {
    const root = createRegistryFixture({
      schemaVersion: "1.0.0",
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          homepageUrl: "https://openai.com",
          logoUrl: "https://github.com/openai.png",
          fallbackInitials: "OI",
          repos: ["openai/skills"],
        },
      ],
    });

    const registry = loadProviderRegistry(root);

    expect(registry.providers).toHaveLength(1);
    expect(registry.byRepo.get("openai/skills")?.id).toBe("openai");
  });

  it("rejects invalid provider URLs", () => {
    const root = createRegistryFixture({
      schemaVersion: "1.0.0",
      providers: [
        {
          id: "bad",
          name: "Bad",
          homepageUrl: "not a url",
          logoUrl: "https://github.com/bad.png",
          fallbackInitials: "B",
          repos: ["bad/repo"],
        },
      ],
    });

    expect(() => loadProviderRegistry(root)).toThrow();
  });
});

describe("resolveProviderForItem", () => {
  it("resolves known skill repos to curated provider metadata", () => {
    const root = createRegistryFixture({
      schemaVersion: "1.0.0",
      providers: [
        {
          id: "stripe",
          name: "Stripe",
          homepageUrl: "https://stripe.com",
          logoUrl: "https://github.com/stripe.png",
          fallbackInitials: "ST",
          repos: ["stripe/ai"],
        },
      ],
    });
    const registry = loadProviderRegistry(root);

    expect(resolveProviderForItem(skillItem("stripe/ai"), registry)).toEqual({
      id: "stripe",
      name: "Stripe",
      homepageUrl: "https://stripe.com",
      logoUrl: "https://github.com/stripe.png",
      fallbackInitials: "ST",
    });
  });

  it("derives fallback provider metadata for unknown GitHub skill repos", () => {
    const registry = loadProviderRegistry(createRegistryFixture({ schemaVersion: "1.0.0", providers: [] }));

    expect(resolveProviderForItem(skillItem("unknown-labs/example-skills"), registry)).toEqual({
      id: "unknown-labs",
      name: "Unknown Labs",
      logoUrl: "https://github.com/unknown-labs.png",
      fallbackInitials: "UL",
    });
  });

  it("resolves AoA-curated plugins to AoA provider", () => {
    const registry = loadProviderRegistry(
      createRegistryFixture({
        schemaVersion: "1.0.0",
        providers: [
          {
            id: "aoa",
            name: "Army of Agents",
            homepageUrl: "https://armyofagents.com",
            logoUrl: "https://github.com/MeteoriteLabs.png",
            fallbackInitials: "AOA",
            repos: ["MeteoriteLabs/aoa-marketplace"],
          },
        ],
      }),
    );

    expect(resolveProviderForItem(pluginItem(), registry)).toEqual({
      id: "aoa",
      name: "Army of Agents",
      homepageUrl: "https://armyofagents.com",
      logoUrl: "https://github.com/MeteoriteLabs.png",
      fallbackInitials: "AOA",
    });
  });
});

function createRegistryFixture(registry: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "provider-registry-test-"));
  tempRoots.push(root);
  mkdirSync(join(root, "content"), { recursive: true });
  writeFileSync(join(root, "content", "providers.json"), JSON.stringify(registry));
  return root;
}

function skillItem(repo: string): CatalogItem {
  return {
    id: `skill:github-skills/${repo}/example`,
    type: "skill",
    name: "Example",
    description: "Example skill",
    version: "1.0.0",
    source: { adapter: "github-skills", url: "https://example.com", locator: "example" },
    trust: { tier: "verified", source: "github-skills" },
    status: "active",
    addedAt: "2026-05-14T00:00:00.000Z",
    category: "engineering",
    tags: [],
    resourceUrl: "https://raw.githubusercontent.com/owner/repo/abc/SKILL.md",
    skill: {
      bundle: {
        type: "github-directory",
        repo,
        commitSha: "abcdef0",
        path: "skills/example",
        treeUrl: "https://github.com/owner/repo/tree/abcdef0/skills/example",
      },
      frontmatter: { raw: {} },
    },
  };
}

function pluginItem(): CatalogItem {
  return {
    id: "plugin:aoa-curated/aoa-plugin-discord",
    type: "plugin",
    name: "Discord",
    description: "Discord integration",
    version: "1.0.0",
    source: {
      adapter: "aoa-curated",
      url: "https://github.com/MeteoriteLabs/aoa-marketplace/tree/abc/plugins/aoa-plugin-discord",
      locator: "plugins/aoa-plugin-discord",
    },
    trust: { tier: "verified", source: "aoa-curated" },
    status: "active",
    addedAt: "2026-05-14T00:00:00.000Z",
    category: "integrations",
    tags: [],
  };
}
