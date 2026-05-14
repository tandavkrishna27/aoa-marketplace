import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { installSkillBundle, validateSkillBundlePath } from "../skill-bundle.js";
import type { SkillBundle } from "../../types/catalog.js";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("validateSkillBundlePath", () => {
  test.each([
    "",
    "/skills/example",
    "C:/skills/example",
    "skills/../example",
    "skills/./example",
    "skills//example",
    "skills/example\0bad",
  ])("rejects unsafe path %s", (path) => {
    expect(() => validateSkillBundlePath(path)).toThrow(/unsafe bundle path/i);
  });

  test("accepts nested relative paths", () => {
    expect(() => validateSkillBundlePath("skills/group/deep-skill")).not.toThrow();
  });
});

describe("installSkillBundle", () => {
  test("installs SKILL.md and sibling files from a local git repo", () => {
    const fixture = createRepoFixture({
      "skills/example/SKILL.md": "---\nname: example\n---\n# Example\n",
      "skills/example/scripts/run.js": "console.log('ok');\n",
      "skills/example/references/guide.md": "# Guide\n",
      "skills/example/assets/template.txt": "template\n",
    });
    const destination = join(fixture.root, "installed", "example");

    const result = installSkillBundle(localBundle(fixture.repo, fixture.commitSha, "skills/example"), {
      destination,
      repoUrl: fixture.repo,
    });

    expect(readFileSync(join(destination, "SKILL.md"), "utf8")).toContain("name: example");
    expect(readFileSync(join(destination, "scripts", "run.js"), "utf8")).toContain("ok");
    expect(readFileSync(join(destination, "references", "guide.md"), "utf8")).toContain("Guide");
    expect(readFileSync(join(destination, "assets", "template.txt"), "utf8")).toBe("template\n");
    expect(result.destination).toBe(destination);
    expect(result.fileCount).toBe(4);
    expect(result.byteCount).toBeGreaterThan(0);
  });

  test("installs nested bundle paths", () => {
    const fixture = createRepoFixture({
      "skills/group/deep-skill/SKILL.md": "# Deep Skill\n",
      "skills/group/deep-skill/scripts/deep.sh": "echo deep\n",
      "skills/other/SKILL.md": "# Other\n",
    });
    const destination = join(fixture.root, "installed", "deep-skill");

    installSkillBundle(localBundle(fixture.repo, fixture.commitSha, "skills/group/deep-skill"), {
      destination,
      repoUrl: fixture.repo,
    });

    expect(existsSync(join(destination, "SKILL.md"))).toBe(true);
    expect(existsSync(join(destination, "scripts", "deep.sh"))).toBe(true);
    expect(existsSync(join(destination, "..", "other"))).toBe(false);
  });

  test("fails when destination exists and overwrite is false", () => {
    const fixture = createRepoFixture({
      "skills/example/SKILL.md": "# Example\n",
    });
    const destination = join(fixture.root, "installed", "example");
    mkdirSync(destination, { recursive: true });

    expect(() =>
      installSkillBundle(localBundle(fixture.repo, fixture.commitSha, "skills/example"), {
        destination,
        repoUrl: fixture.repo,
      }),
    ).toThrow(/destination already exists/i);
  });

  test("overwrites destination when overwrite is true", () => {
    const fixture = createRepoFixture({
      "skills/example/SKILL.md": "# Example\n",
    });
    const destination = join(fixture.root, "installed", "example");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "stale.txt"), "stale\n");

    installSkillBundle(localBundle(fixture.repo, fixture.commitSha, "skills/example"), {
      destination,
      overwrite: true,
      repoUrl: fixture.repo,
    });

    expect(existsSync(join(destination, "stale.txt"))).toBe(false);
    expect(existsSync(join(destination, "SKILL.md"))).toBe(true);
  });

  test("fails when bundle directory has no SKILL.md", () => {
    const fixture = createRepoFixture({
      "skills/example/README.md": "# Missing skill file\n",
    });

    expect(() =>
      installSkillBundle(localBundle(fixture.repo, fixture.commitSha, "skills/example"), {
        destination: join(fixture.root, "installed", "example"),
        repoUrl: fixture.repo,
      }),
    ).toThrow(/SKILL\.md/i);
  });
});

function createRepoFixture(files: Record<string, string>): { root: string; repo: string; commitSha: string } {
  const root = mkdtempSync(join(tmpdir(), "skill-bundle-test-"));
  tempRoots.push(root);
  const repo = join(root, "repo");
  mkdirSync(repo, { recursive: true });

  execFileSync("git", ["init", "-b", "main"], { cwd: repo, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: repo });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: repo });

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = join(repo, relativePath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, contents);
  }

  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: repo, stdio: "ignore" });
  const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

  return { root, repo, commitSha };
}

function localBundle(repoPath: string, commitSha: string, path: string): SkillBundle {
  return {
    type: "github-directory",
    repo: "test-org/test-skills",
    commitSha,
    path,
    treeUrl: `file://${repoPath}`,
  };
}
