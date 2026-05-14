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

const validSkillItem: CatalogItem = {
  id: "skill:test/tooling",
  type: "skill",
  name: "Test Skill",
  description: "A test skill for unit tests",
  version: "1.0.0",
  source: { adapter: "test", url: "https://example.com", locator: "skills/tooling", commitSha: "abc1234" },
  trust: { tier: "verified", source: "test" },
  status: "active",
  addedAt: "2026-05-07T00:00:00.000Z",
  category: "engineering",
  tags: [],
  resourceUrl: "https://raw.githubusercontent.com/owner/repo/abc1234/skills/tooling/SKILL.md",
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

  it("fails skill items with resourceUrl and no bundle", () => {
    const result = runAutomatedChecks(validSkillItem);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain("skill item with resourceUrl must declare skill.bundle");
  });

  it("fails skill bundles with path traversal", () => {
    const result = runAutomatedChecks({
      ...validSkillItem,
      skill: {
        bundle: {
          type: "github-directory",
          repo: "owner/repo",
          commitSha: "abc1234",
          path: "../escape",
          treeUrl: "https://github.com/owner/repo/tree/abc1234/../escape",
        },
        frontmatter: { raw: {} },
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain("skill.bundle.path must be a safe relative path");
  });

  it.each(["skills/..", "C:/escape", "C:\\escape", "C:escape"])(
    "fails skill bundles with unsafe path %s",
    (path) => {
      const result = runAutomatedChecks({
        ...validSkillItem,
        skill: {
          bundle: {
            type: "github-directory",
            repo: "owner/repo",
            commitSha: "abc1234",
            path,
            treeUrl: "https://github.com/owner/repo/tree/abc1234/skills/tooling",
          },
          frontmatter: { raw: {} },
        },
      });

      expect(result.passed).toBe(false);
      expect(result.failures).toContain("skill.bundle.path must be a safe relative path");
    },
  );

  it("accepts dot as the repo-root skill bundle path", () => {
    const result = runAutomatedChecks({
      ...validSkillItem,
      source: { ...validSkillItem.source, url: "https://github.com/owner/repo/tree/abc1234", locator: "owner/repo" },
      skill: {
        bundle: {
          type: "github-directory",
          repo: "owner/repo",
          commitSha: "abc1234",
          path: ".",
          treeUrl: "https://github.com/owner/repo/tree/abc1234",
        },
        frontmatter: { raw: {} },
      },
    });

    expect(result.passed).toBe(true);
  });

  it("warns for broad allowed-tools values", () => {
    const result = runAutomatedChecks({
      ...validSkillItem,
      skill: {
        bundle: {
          type: "github-directory",
          repo: "owner/repo",
          commitSha: "abc1234",
          path: "skills/tooling",
          treeUrl: "https://github.com/owner/repo/tree/abc1234/skills/tooling",
        },
        frontmatter: { allowedTools: "shell *", raw: { "allowed-tools": "shell *" } },
      },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain("Skill requests broad allowed-tools permissions");
  });

  it.each(["Bash, Read", "Bash(git:*)", "shell, web"])(
    "warns without failing for broad allowed-tools token %s",
    (allowedTools) => {
      const result = runAutomatedChecks({
        ...validSkillItem,
        skill: {
          bundle: {
            type: "github-directory",
            repo: "owner/repo",
            commitSha: "abc1234",
            path: "skills/tooling",
            treeUrl: "https://github.com/owner/repo/tree/abc1234/skills/tooling",
          },
          frontmatter: { allowedTools, raw: { "allowed-tools": allowedTools } },
        },
      });

      expect(result.passed).toBe(true);
      expect(result.warnings).toContain("Skill requests broad allowed-tools permissions");
    },
  );
});

describe("automated-checks markdown size cap", () => {
  const baseItem: CatalogItem = {
    id: "skill:test/foo",
    type: "skill",
    name: "Test",
    description: "x",
    version: "1.0.0",
    source: { adapter: "test", url: "https://example.com", locator: "x", commitSha: "abc" },
    trust: { tier: "verified", source: "test" },
    status: "active",
    addedAt: "2026-05-07T00:00:00.000Z",
    category: "engineering",
    tags: [],
  };

  it("fails skills with inline content > 64 KB", () => {
    const big = "x".repeat(65_537); // Exceeds 64 KB (65,536 bytes)
    const item = { ...baseItem, content: { inline: big } };
    const result = runAutomatedChecks(item);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /size/i.test(f))).toBe(true);
  });

  it("passes skills with inline content <= 64 KB", () => {
    const small = "x".repeat(60_000);
    const item = { ...baseItem, content: { inline: small } };
    const result = runAutomatedChecks(item, { license: "MIT" });
    expect(result.passed).toBe(true);
  });

  it("passes skills with no inline content (size cap N/A)", () => {
    const result = runAutomatedChecks(baseItem, { license: "MIT" });
    expect(result.passed).toBe(true);
  });
});
