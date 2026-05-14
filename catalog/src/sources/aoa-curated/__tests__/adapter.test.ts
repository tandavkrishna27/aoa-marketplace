import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { aoaCuratedAdapter } from "../adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(__dirname, "fixtures");

const ctx = {
  workDir: fixtureRoot,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  commitSha: "abc1234567890fedcba9876543210fedcba98765",
};

describe("aoaCuratedAdapter", () => {
  it("scans plugins/ + content/ and returns NormalizedItem entries", async () => {
    const raw = await aoaCuratedAdapter.fetch(ctx);
    const normalizedItems = await aoaCuratedAdapter.normalize(raw, ctx);

    // Should find 1 plugin, 1 skill, and 1 valid agent.
    expect(normalizedItems).toHaveLength(3);

    const pluginEntry = normalizedItems.find((n) => n.item.type === "plugin");
    expect(pluginEntry).toBeDefined();
    const plugin = pluginEntry!.item;
    expect(plugin.id).toBe("plugin:aoa-curated/example");
    expect(plugin.name).toBe("Example Plugin");
    expect(plugin.source.adapter).toBe("aoa-curated");
    expect(plugin.trust.tier).toBe("verified");
    expect(plugin.source.locator).toBe("plugins/example");
    expect(plugin.capabilities).toHaveLength(1);
    expect(plugin.capabilities?.[0].id).toBe("example.do_thing");
    expect(plugin.capabilities?.[0].description).toBe("Does an example thing for testing");
    expect(plugin.category).toBe("engineering");
    // rawManifest should include the license field from manifest.json
    expect(pluginEntry!.rawManifest?.["license"]).toBe("MIT");

    const skillEntry = normalizedItems.find((n) => n.item.type === "skill");
    expect(skillEntry).toBeDefined();
    const skill = skillEntry!.item;
    expect(skill.id).toBe("skill:aoa-curated/example-skill");
    expect(skill.name).toBe("Example Skill");
    expect(skill.source.locator).toBe("content/skills/example-skill");
    expect(skill.content?.inline).toContain("Example Skill");
    // rawManifest should include the license field from the content manifest.json
    expect(skillEntry!.rawManifest?.["license"]).toBe("MIT");
  });

  it("returns empty array if neither plugins/ nor content/ directory exists", async () => {
    const emptyCtx = { ...ctx, workDir: "/nonexistent/path/never" };
    const raw = await aoaCuratedAdapter.fetch(emptyCtx);
    const items = await aoaCuratedAdapter.normalize(raw, emptyCtx);
    expect(items).toEqual([]);
  });
});

describe("aoaCuratedAdapter agent standard", () => {
  it("emits a validated agent item with multiple skill and plugin requirements", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const agent = items.find((i) => i.item.id === "agent:aoa-curated/valid-agent");

    expect(agent).toBeDefined();
    expect(agent!.item.type).toBe("agent");
    expect(agent!.item.resourceUrl).toContain("/content/agents/valid-agent/agent.json");
    expect(agent!.item.requires).toEqual([
      { type: "skill", id: "skill:github-skills/openai/skills/openai-docs" },
      { type: "skill", id: "skill:github-skills/auth0/skills/auth0" },
      { type: "plugin", id: "plugin:aoa-curated/aoa-plugin-github-issues", versionRange: "^1.0.0" },
      { type: "plugin", id: "plugin:aoa-curated/aoa-plugin-slack", versionRange: "^1.0.0" },
    ]);
  });

  it("skips invalid agent folders and keeps valid agents", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const ids = items.map((entry) => entry.item.id);

    expect(ids).toContain("agent:aoa-curated/valid-agent");
    expect(ids).not.toContain("agent:aoa-curated/missing-agent-json");
    expect(ids).not.toContain("agent:aoa-curated/bad-schema-version");
    expect(ids).not.toContain("agent:aoa-curated/missing-instructions");
    expect(ids).not.toContain("agent:aoa-curated/undeclared-alias");
  });
});

describe("aoaCuratedAdapter — M.2.0 catalog field additions", () => {
  it("emits npm field on plugin items", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const plugin = items.find((i) => i.item.type === "plugin");
    expect(plugin).toBeDefined();
    expect(plugin!.item.npm).toBeDefined();
    // Fixture plugin name is "@armyofagents/aoa-plugin-example"; assertion is generic enough
    // to cover both real plugins (aoa-plugin-*) and the scoped fixture name.
    expect(plugin!.item.npm!.packageName).toMatch(/aoa-plugin-/);
    expect(plugin!.item.npm!.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("emits commit-pinned source.url on plugin items", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const plugin = items.find((i) => i.item.type === "plugin");
    expect(plugin!.item.source.commitSha).toBe(ctx.commitSha);
    if (plugin!.item.source.url.includes("github.com")) {
      expect(plugin!.item.source.url).toContain(`/tree/${ctx.commitSha}/`);
    }
  });

  it("emits resourceUrl on snapshot items (skill/agent/team)", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const snapshots = items.filter((i) => i.item.type !== "plugin");
    expect(snapshots.length).toBeGreaterThan(0);
    for (const s of snapshots) {
      expect(s.item.resourceUrl).toBeDefined();
      expect(s.item.resourceUrl!).toContain(ctx.commitSha);
      expect(s.item.resourceUrl!).toMatch(/raw\.githubusercontent\.com/);
    }
  });

  it("emits tarballUrl on plugin items with correct pattern", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const plugin = items.find((i) => i.item.type === "plugin");
    expect(plugin).toBeDefined();
    // tarballUrl must be set and reference MeteoriteLabs releases
    expect(plugin!.item.npm!.tarballUrl).toBeDefined();
    expect(plugin!.item.npm!.tarballUrl).toContain(
      "https://github.com/MeteoriteLabs/aoa-marketplace/releases/download/v",
    );
    // URL must include the plugin version
    expect(plugin!.item.npm!.tarballUrl).toContain(plugin!.item.version);
    // URL must end in .tgz
    expect(plugin!.item.npm!.tarballUrl).toMatch(/\.tgz$/);
  });
});
