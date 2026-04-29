import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { aoaCuratedAdapter } from "../adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(__dirname, "fixtures");

const ctx = {
  workDir: fixtureRoot,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
};

describe("aoaCuratedAdapter", () => {
  it("scans plugins/ + content/ and returns CatalogItem entries", async () => {
    const raw = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(raw, ctx);

    // Should find 1 plugin (plugins/example) + 1 skill (content/skills/example-skill) = 2 items
    expect(items).toHaveLength(2);

    const plugin = items.find((i) => i.type === "plugin");
    expect(plugin).toBeDefined();
    expect(plugin?.id).toBe("plugin:aoa-curated/example");
    expect(plugin?.name).toBe("Example Plugin");
    expect(plugin?.source.adapter).toBe("aoa-curated");
    expect(plugin?.trust.tier).toBe("verified");
    expect(plugin?.source.locator).toBe("plugins/example");
    expect(plugin?.capabilities).toHaveLength(1);
    expect(plugin?.capabilities?.[0].id).toBe("example.do_thing");
    expect(plugin?.capabilities?.[0].description).toBe("Does an example thing for testing");
    expect(plugin?.category).toBe("engineering");

    const skill = items.find((i) => i.type === "skill");
    expect(skill).toBeDefined();
    expect(skill?.id).toBe("skill:aoa-curated/example-skill");
    expect(skill?.name).toBe("Example Skill");
    expect(skill?.source.locator).toBe("content/skills/example-skill");
    expect(skill?.content?.inline).toContain("Example Skill");
  });

  it("returns empty array if neither plugins/ nor content/ directory exists", async () => {
    const emptyCtx = { ...ctx, workDir: "/nonexistent/path/never" };
    const raw = await aoaCuratedAdapter.fetch(emptyCtx);
    const items = await aoaCuratedAdapter.normalize(raw, emptyCtx);
    expect(items).toEqual([]);
  });
});
