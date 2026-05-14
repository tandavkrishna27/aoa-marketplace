import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execSync } from "node:child_process";
import { aggregate } from "../aggregate.js";

describe("aggregate", () => {
  // Integration test: runs the full pipeline against the real monorepo + (optionally) network.
  // - With network: anthropic-skills adapter clones successfully, returns N items.
  // - Without network: anthropic-skills fails inside aggregate's try/catch, returns 0 items.
  // Either way, validateOnly: true skips writing dist/catalog.json.
  it("runs end-to-end without crashing", async () => {
    const catalog = await aggregate({ validateOnly: true });
    const skillItems = catalog.items.filter((item) => item.type === "skill");

    if (skillItems.length > 0) {
      expect(skillItems.every((item) => item.skill?.bundle !== undefined)).toBe(true);
      expect(skillItems.every((item) => item.resourceUrl !== undefined)).toBe(true);
    }

    if (catalog.items.length > 0) {
      expect(catalog.items.every((item) => item.provider !== undefined)).toBe(true);
    }

    const discord = catalog.items.find((item) => item.id === "plugin:aoa-curated/aoa-plugin-discord");
    if (discord) {
      expect(discord.provider?.id).toBe("aoa");
    }

    const openaiDocs = catalog.items.find((item) => item.id === "skill:github-skills/openai/skills/openai-docs");
    if (openaiDocs) {
      expect(openaiDocs.provider?.id).toBe("openai");
    }

    const remotion = catalog.items.find(
      (item) => item.id === "skill:github-skills/google-labs-code/stitch-skills/remotion",
    );
    if (remotion) {
      expect(remotion.provider?.id).toBe("google-labs-stitch");
    }

    if (catalog.items.some((item) => item.source.adapter === "anthropic-skills")) {
      const anthropicFrontend = catalog.items.find(
        (item) => item.id === "skill:anthropic/frontend-design"
      );
      expect(anthropicFrontend?.skill?.bundle.path).toBe("skills/frontend-design");
    }

    const azureNested = catalog.items.find(
      (item) =>
        item.id ===
        "skill:github-skills/microsoft/azure-skills/microsoft-foundry/models/deploy-model/capacity"
    );
    if (azureNested) {
      expect(azureNested.skill?.bundle.path).toBe(
        "skills/microsoft-foundry/models/deploy-model/capacity"
      );
    }

    expect(catalog.schemaVersion).toBe("1.0.0");
    expect(catalog.itemCount).toBeGreaterThanOrEqual(0);
    expect(catalog.items.every((i) => i.id.length > 0)).toBe(true);
    expect(catalog.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, { timeout: 60_000 });

  describe("github-skills adapter integration", () => {
    let tempDir: string;
    let fixtureRepoPath: string;
    let originalTsPath: string | undefined;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "aggregate-test-"));
    });

    afterEach(() => {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    function makeFixtureRepo(name: string, files: Record<string, string>): string {
      const dir = join(tempDir, name);
      mkdirSync(dir, { recursive: true });
      spawnSync("git", ["init", "-q", "--initial-branch=main"], { cwd: dir });
      spawnSync("git", ["config", "user.email", "test@test"], { cwd: dir });
      spawnSync("git", ["config", "user.name", "test"], { cwd: dir });
      for (const [path, content] of Object.entries(files)) {
        const full = join(dir, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
      }
      spawnSync("git", ["add", "-A"], { cwd: dir });
      spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
      return dir;
    }

    it("includes github-skills items in catalog when configured", async () => {
      // Create fixture repo with a SKILL.md
      fixtureRepoPath = makeFixtureRepo("test-skills", {
        "my-skill/SKILL.md": `---
name: Test Skill
description: A test skill for integration testing
version: 1.0.0
---
# Test Skill
This is a test skill.`,
      });

      // Create trusted-sources.json in temp dir with github-skills entry
      // Note: aggregate() reads from REPO_ROOT which points to the actual monorepo
      // Since the adapter looks for trusted-sources.json in workDir, we mock it via env var
      const trustedSourcesPath = join(tempDir, "trusted-sources.json");
      writeFileSync(
        trustedSourcesPath,
        JSON.stringify({
          schemaVersion: "1.0.0",
          trustedSources: [
            {
              adapter: "github-skills",
              tier: "community",
              reason: "Test fixture",
              config: {
                repo: "test-org/test-skills",
                ref: "main",
                skillsPath: ".",
                defaultCategory: "productivity",
                ignore: ["node_modules", ".git"],
              },
            },
          ],
        }, null, 2)
      );

      // Set env overrides for testing
      const originalOverride = process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
      process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = `test-org/test-skills=${fixtureRepoPath}`;

      // Copy trusted-sources to REPO_ROOT temporarily for the test
      // REPO_ROOT is determined in aggregate.ts: two levels up from catalog/src
      const repoRoot = execSync("git rev-parse --show-toplevel", {
        encoding: "utf-8",
      }).trim();
      const originalTsPath2 = join(repoRoot, "trusted-sources.json");

      // Back up original if it exists
      if (existsSync(originalTsPath2)) {
        originalTsPath = readFileSync(originalTsPath2, "utf-8");
      }

      try {
        // Write test trusted-sources.json to repo root
        writeFileSync(originalTsPath2, readFileSync(trustedSourcesPath, "utf-8"));

        // Call aggregate
        const outputPath = join(tempDir, "catalog.json");
        const catalog = await aggregate({
          validateOnly: false,
          outputPath,
        });

        // Verify catalog contains github-skills items
        expect(catalog.itemCount).toBeGreaterThan(0);
        const skillItems = catalog.items.filter((item) => item.type === "skill");
        expect(skillItems.length).toBeGreaterThan(0);
        expect(skillItems.every((item) => item.skill?.bundle !== undefined)).toBe(true);
        expect(skillItems.every((item) => item.resourceUrl !== undefined)).toBe(true);
        expect(catalog.items.every((item) => item.provider !== undefined)).toBe(true);

        const githubSkillsItems = catalog.items.filter(
          (item) => item.source.adapter === "github-skills"
        );
        expect(githubSkillsItems.length).toBeGreaterThan(0);
        expect(githubSkillsItems[0].id).toMatch(/^skill:github-skills\//);
        expect(githubSkillsItems[0].skill?.bundle.path).toBe("my-skill");
      } finally {
        // Restore original trusted-sources.json if it existed
        if (originalTsPath) {
          writeFileSync(originalTsPath2, originalTsPath);
        } else if (existsSync(originalTsPath2)) {
          rmSync(originalTsPath2);
        }

        // Restore env vars
        if (originalOverride !== undefined) {
          process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO = originalOverride;
        } else {
          delete process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
        }
      }
    }, { timeout: 60_000 });
  });
});
