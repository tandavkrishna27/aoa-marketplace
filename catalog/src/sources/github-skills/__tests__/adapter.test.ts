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

describe("githubSkillsAdapter.normalize ignore pattern escaping", () => {
  it("ignore patterns escape regex specials (e.g. dot in .factory)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-esc-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake-repo.git", {
        "LICENSE": "MIT License\n",
        "skills/.factory/SKILL.md": `---\nname: should-be-ignored\ndescription: x\n---`,
        "skills/afactory/SKILL.md": `---\nname: should-NOT-be-ignored\ndescription: x\n---`,
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
              },
            },
          ],
        }),
      );
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = await githubSkillsAdapter.fetch(ctx);
      const items = await githubSkillsAdapter.normalize(raw, ctx);
      const slugs = items.map((i) => i.item.id.split("/").pop());
      expect(slugs).toContain("afactory");
      expect(slugs).not.toContain(".factory");
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });
});

describe("githubSkillsAdapter.normalize", () => {
  it("uses the full relative skill directory for nested skill ids", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-nested-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake-repo.git", {
        "LICENSE": "MIT License\n",
        "skills/microsoft-foundry/SKILL.md": `---
name: microsoft-foundry
description: Microsoft Foundry skill
---

Body.`,
        "skills/microsoft-foundry/models/deploy-model/SKILL.md": `---
name: deploy-model
description: Deploy model skill
---

Body.`,
        "skills/microsoft-foundry/models/deploy-model/capacity/SKILL.md": `---
name: capacity
description: Capacity skill
---

Body.`,
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
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = await githubSkillsAdapter.fetch(ctx);
      const items = await githubSkillsAdapter.normalize(raw, ctx);

      expect(items).toHaveLength(3);
      expect(items.map((i) => i.item.id)).toEqual([
        "skill:github-skills/local/fake/microsoft-foundry",
        "skill:github-skills/local/fake/microsoft-foundry/models/deploy-model",
        "skill:github-skills/local/fake/microsoft-foundry/models/deploy-model/capacity",
      ]);
      const deepest = items.find((i) =>
        i.item.id.endsWith("/microsoft-foundry/models/deploy-model/capacity"),
      );
      expect(deepest?.item.source.locator).toBe(
        "local/fake/skills/microsoft-foundry/models/deploy-model/capacity",
      );
      expect(deepest?.item.skill?.bundle.path).toBe(
        "skills/microsoft-foundry/models/deploy-model/capacity",
      );
      expect(deepest?.item.resourceUrl).toMatch(
        /\/skills\/microsoft-foundry\/models\/deploy-model\/capacity\/SKILL\.md$/,
      );
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });

  it("imports only skills under the configured skillsPath", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-skillspath-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake-repo.git", {
        "LICENSE": "MIT License\nCopyright (c) 2026 Test\n",
        "skills/azure-ai/SKILL.md": `---
name: azure-ai
description: Azure AI skill
version: 1.0.0
---

Body.`,
        ".github/plugins/azure-skills/skills/azure-ai/SKILL.md": `---
name: duplicate-azure-ai
description: Duplicate Azure AI skill
version: 1.0.0
---

Body.`,
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
                defaultCategory: "engineering",
              },
            },
          ],
        }),
      );
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = await githubSkillsAdapter.fetch(ctx);
      const items = await githubSkillsAdapter.normalize(raw, ctx);

      expect(items).toHaveLength(1);
      expect(items[0].item.id).toBe("skill:github-skills/local/fake/azure-ai");
      expect(items[0].item.name).toBe("azure-ai");
      expect(items[0].item.source.locator).toBe("local/fake/skills/azure-ai");
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });

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
      expect(foo!.item.skill?.bundle).toEqual({
        type: "github-directory",
        repo: "local/fake",
        commitSha: expect.stringMatching(/^[a-f0-9]{7,40}$/),
        path: "skills/foo",
        treeUrl: expect.stringMatching(
          /^https:\/\/github\.com\/local\/fake\/tree\/[a-f0-9]{7,40}\/skills\/foo$/,
        ),
      });
      expect(foo!.item.skill?.frontmatter.license).toBeUndefined();
      expect(foo!.item.skill?.frontmatter.raw.name).toBe("foo");
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

  it("points bundle at the full skill directory when support files exist", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-bundle-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake.git", {
        "LICENSE": "MIT License\n",
        "skills/tooling/SKILL.md": `---
name: tooling
description: Tooling skill
license: MIT
compatibility: Requires shell
allowed-tools: shell
metadata:
  provider: TestCo
---

Body.`,
        "skills/tooling/scripts/run.sh": "echo ok\n",
        "skills/tooling/references/guide.md": "# Guide\n",
        "skills/tooling/assets/template.txt": "template\n",
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
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = await githubSkillsAdapter.fetch(ctx);
      const items = await githubSkillsAdapter.normalize(raw, ctx);

      expect(items).toHaveLength(1);
      expect(items[0].item.skill?.bundle.path).toBe("skills/tooling");
      expect(items[0].item.skill?.frontmatter.license).toBe("MIT");
      expect(items[0].item.skill?.frontmatter.compatibility).toBe("Requires shell");
      expect(items[0].item.skill?.frontmatter.allowedTools).toBe("shell");
      expect(items[0].item.skill?.frontmatter.metadata).toEqual({ provider: "TestCo" });
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });
});

describe("githubSkillsAdapter auto-applies requires-cli-tooling", () => {
  it("adds the tag when overrides supply runtimeRequires", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-tag-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake.git", {
        "LICENSE": "MIT License\n",
        "skills/qa/SKILL.md": `---\nname: qa\ndescription: qa skill\n---\n\nBody.`,
      });
      mkdirSync(join(tmp, "content"), { recursive: true });
      writeFileSync(
        join(tmp, "content", "skill-overrides.json"),
        JSON.stringify({
          "skill:github-skills/local/fake/qa": ["gstack-bin", "gstack-browse-daemon"],
        }),
      );
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
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = await githubSkillsAdapter.fetch(ctx);
      const items = await githubSkillsAdapter.normalize(raw, ctx);
      const qa = items[0];
      expect(qa.item.runtimeRequires).toEqual(["gstack-bin", "gstack-browse-daemon"]);
      expect(qa.item.tags).toContain("requires-cli-tooling");
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });

  it("does not add the tag when neither frontmatter nor overrides have runtimeRequires", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-nopt-"));
    try {
      const fixture = makeFixtureRepo(tmp, "fake.git", {
        "LICENSE": "MIT License\n",
        "skills/clean/SKILL.md": `---\nname: clean\ndescription: clean skill\n---\n\nBody.`,
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
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `local/fake=file://${fixture}`;
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = await githubSkillsAdapter.fetch(ctx);
      const items = await githubSkillsAdapter.normalize(raw, ctx);
      const clean = items[0];
      expect(clean.item.runtimeRequires).toBeUndefined();
      expect(clean.item.tags).not.toContain("requires-cli-tooling");
    } finally {
      delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      rmSync(tmp, { recursive: true });
    }
  });
});
