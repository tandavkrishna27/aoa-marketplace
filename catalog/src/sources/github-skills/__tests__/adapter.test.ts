import { describe, expect, it } from "vitest";
import { githubSkillsAdapter } from "../adapter.js";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

function silentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

describe("githubSkillsAdapter shape", () => {
  it("has correct id", () => {
    expect(githubSkillsAdapter.id).toBe("github-skills");
  });

  it("has displayName", () => {
    expect(githubSkillsAdapter.displayName).toBe("GitHub Skills");
  });

  it("has community as default trust tier", () => {
    expect(githubSkillsAdapter.defaultTrustTier).toBe("community");
  });

  it("conforms to SourceAdapter interface", () => {
    expect(typeof githubSkillsAdapter.fetch).toBe("function");
    expect(typeof githubSkillsAdapter.normalize).toBe("function");
  });
});

describe("githubSkillsAdapter.fetch sources enumeration", () => {
  it("returns an empty list when trusted-sources.json has no github-skills entries", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-"));
    try {
      writeFileSync(
        join(tmp, "trusted-sources.json"),
        JSON.stringify({ schemaVersion: "1.0.0", trustedSources: [] }),
      );
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = (await githubSkillsAdapter.fetch(ctx)) as { sources: unknown[] };
      expect(raw.sources).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });

  it("filters to github-skills entries only", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-"));
    try {
      writeFileSync(
        join(tmp, "trusted-sources.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          trustedSources: [
            { adapter: "aoa-curated", tier: "verified", reason: "x" },
            {
              adapter: "github-skills",
              tier: "verified",
              reason: "gstack",
              config: { repo: "garrytan/gstack", ref: "main" },
            },
          ],
        }),
      );
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = (await githubSkillsAdapter.fetch(ctx)) as { sources: Array<{ config: { repo: string } }> };
      expect(raw.sources).toHaveLength(1);
      expect(raw.sources[0].config.repo).toBe("garrytan/gstack");
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });
});

function makeFixtureRepo(parent: string, name: string, files: Record<string, string>): string {
  const dir = join(parent, name);
  mkdirSync(dir);
  spawnSync("git", ["init", "-q", "--initial-branch=main"], { cwd: dir });
  spawnSync("git", ["config", "user.email", "test@test"], { cwd: dir });
  spawnSync("git", ["config", "user.name", "test"], { cwd: dir });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  spawnSync("git", ["add", "-A"], { cwd: dir });
  spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
  return dir;
}

describe("githubSkillsAdapter.fetch clones sources", () => {
  it("shallow-clones each configured source", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-clone-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake-repo.git", {
        "skills/foo/SKILL.md": `---\nname: foo\ndescription: foo skill\n---\n\nBody.`,
      });
      writeFileSync(
        join(tmp, "trusted-sources.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          trustedSources: [
            {
              adapter: "github-skills",
              tier: "verified",
              reason: "fixture",
              config: { repo: "local/fake", ref: "main", skillsPath: "skills" },
            },
          ],
        }),
      );
      // The adapter normally clones from https://github.com/<repo>.git — to test
      // without network, set GITHUB_SKILLS_TEST_OVERRIDE_REPO env to map repo→file://
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = (await githubSkillsAdapter.fetch(ctx)) as { sources: Array<{ cloneDir: string; sourceCommitSha: string }> };
      expect(raw.sources).toHaveLength(1);
      expect(raw.sources[0].cloneDir).toBeTruthy();
      expect(raw.sources[0].sourceCommitSha).toMatch(/^[a-f0-9]{7,40}$/);
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });
});

describe("githubSkillsAdapter.normalize", () => {
  it("emits one NormalizedItem per SKILL.md found", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-norm-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake-repo.git", {
        "LICENSE": "MIT License\nCopyright (c) 2026 Test\n",
        "skills/foo/SKILL.md": `---
name: foo
description: foo skill description
version: 1.2.3
category: engineering
---

Body.`,
        "skills/bar/SKILL.md": `---
name: bar
description: bar skill
---

Body.`,
        "skills/.factory/skip/SKILL.md": "should be ignored",
      });
      writeFileSync(
        join(tmp, "trusted-sources.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          trustedSources: [
            {
              adapter: "github-skills",
              tier: "verified",
              reason: "fixture",
              config: {
                repo: "local/fake",
                ref: "main",
                skillsPath: "skills",
                ignore: ["**/.factory/**"],
                defaultCategory: "productivity",
              },
            },
          ],
        }),
      );
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = await githubSkillsAdapter.fetch(ctx);
      const items = await githubSkillsAdapter.normalize(raw, ctx);
      expect(items).toHaveLength(2); // foo + bar (.factory ignored)
      const foo = items.find((i) => i.item.id.endsWith("/foo"));
      expect(foo).toBeDefined();
      expect(foo!.item.name).toBe("foo");
      expect(foo!.item.description).toBe("foo skill description");
      expect(foo!.item.version).toBe("1.2.3");
      expect(foo!.item.category).toBe("engineering");
      expect(foo!.item.source.adapter).toBe("github-skills");
      expect(foo!.item.source.locator).toBe("local/fake/skills/foo");
      expect(foo!.item.resourceUrl).toMatch(/raw\.githubusercontent\.com\/local\/fake/);
      expect(foo!.item.runtimeRequires).toBeUndefined();
      const bar = items.find((i) => i.item.id.endsWith("/bar"));
      expect(bar!.item.category).toBe("productivity"); // fallback to defaultCategory
      expect(foo!.rawManifest?.license).toBe("MIT");
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });
});
