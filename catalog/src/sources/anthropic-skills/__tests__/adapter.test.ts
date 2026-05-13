import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { anthropicSkillsAdapter } from "../adapter.js";

function silentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

function withFixtureRepo(files: Record<string, string>, run: (dir: string) => Promise<void>) {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "anthropic-skills-fixture-"));
    try {
      for (const [path, content] of Object.entries(files)) {
        const full = join(dir, path);
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, content);
      }
      await run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

describe("anthropicSkillsAdapter", () => {
  it("has expected metadata", () => {
    expect(anthropicSkillsAdapter.id).toBe("anthropic-skills");
    expect(anthropicSkillsAdapter.displayName).toBe("Anthropic Skills");
    expect(anthropicSkillsAdapter.defaultTrustTier).toBe("verified");
  });

  it("normalizes skills from the upstream skills directory", withFixtureRepo(
    {
      "skills/frontend-design/SKILL.md": `---
name: frontend-design
description: Build polished frontend experiences
version: 1.2.3
---

# Frontend Design
`,
    },
    async (cloneDir) => {
      const ctx = {
        workDir: cloneDir,
        logger: silentLogger(),
        commitSha: "abc1234567890fedcba9876543210fedcba98765",
      };

      const items = await anthropicSkillsAdapter.normalize(
        { cloneDir, cloneTimestamp: "2026-05-14T00:00:00.000Z" },
        ctx,
      );

      expect(items).toHaveLength(1);
      expect(items[0].item.id).toBe("skill:anthropic/frontend-design");
      expect(items[0].item.name).toBe("frontend-design");
      expect(items[0].item.description).toBe("Build polished frontend experiences");
      expect(items[0].item.version).toBe("1.2.3");
      expect(items[0].item.source.url).toBe(
        "https://github.com/anthropics/skills/tree/main/skills/frontend-design",
      );
      expect(items[0].item.content?.inline).toContain("# Frontend Design");
      expect(items[0].rawManifest).toBeUndefined();
    },
  ));

  it("does not import root folders when the upstream skills directory exists", withFixtureRepo(
    {
      "skills/pdf/SKILL.md": `---
name: pdf
description: Work with PDF files
version: 1.0.0
---

# PDF
`,
      "template/SKILL.md": `---
name: template-skill
description: Template skill
version: 1.0.0
---

# Template
`,
    },
    async (cloneDir) => {
      const ctx = {
        workDir: cloneDir,
        logger: silentLogger(),
        commitSha: "abc1234567890fedcba9876543210fedcba98765",
      };

      const items = await anthropicSkillsAdapter.normalize(
        { cloneDir, cloneTimestamp: "2026-05-14T00:00:00.000Z" },
        ctx,
      );

      expect(items.map((i) => i.item.id)).toEqual(["skill:anthropic/pdf"]);
    },
  ));

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
