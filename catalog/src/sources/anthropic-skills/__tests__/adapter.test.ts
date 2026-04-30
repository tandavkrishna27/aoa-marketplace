import { describe, it, expect } from "vitest";
import { anthropicSkillsAdapter } from "../adapter.js";

describe("anthropicSkillsAdapter", () => {
  it("has expected metadata", () => {
    expect(anthropicSkillsAdapter.id).toBe("anthropic-skills");
    expect(anthropicSkillsAdapter.displayName).toBe("Anthropic Skills");
    expect(anthropicSkillsAdapter.defaultTrustTier).toBe("verified");
  });

  // Note: live network test (skipped in CI by default; run locally with RUN_NETWORK_TESTS=1)
  it.skipIf(!process.env.RUN_NETWORK_TESTS)("clones and parses anthropic/skills", async () => {
    const ctx = {
      workDir: "/tmp/test-workdir",
      logger: { info: console.log, warn: console.warn, error: console.error },
    };
    const raw = await anthropicSkillsAdapter.fetch(ctx);
    const items = await anthropicSkillsAdapter.normalize(raw, ctx);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].source.adapter).toBe("anthropic-skills");
    expect(items[0].type).toBe("skill");
    expect(items[0].trust.tier).toBe("verified");
    expect(items[0].id).toMatch(/^skill:anthropic\//);
    expect(items[0].source.url).toMatch(/^https:\/\/github\.com\/anthropics\/skills\/tree\/main\//);
    expect(items[0].content?.inline).toBeDefined();
  }, { timeout: 60_000 });
});
