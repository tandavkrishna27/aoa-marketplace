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
      commitSha: "abc1234567890fedcba9876543210fedcba98765",
    };
    const raw = await anthropicSkillsAdapter.fetch(ctx);
    const normalizedItems = await anthropicSkillsAdapter.normalize(raw, ctx);
    expect(normalizedItems.length).toBeGreaterThan(0);
    const first = normalizedItems[0].item;
    expect(first.source.adapter).toBe("anthropic-skills");
    expect(first.type).toBe("skill");
    expect(first.trust.tier).toBe("verified");
    expect(first.id).toMatch(/^skill:anthropic\//);
    expect(first.source.url).toMatch(/^https:\/\/github\.com\/anthropics\/skills\/tree\/main\//);
    expect(first.content?.inline).toBeDefined();
    // anthropic-skills omits rawManifest (no license in frontmatter)
    expect(normalizedItems[0].rawManifest).toBeUndefined();
  }, { timeout: 60_000 });
});
