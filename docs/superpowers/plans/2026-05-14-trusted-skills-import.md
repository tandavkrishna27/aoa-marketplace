# Trusted Skills Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import all skills from trusted Anthropic and Microsoft Azure sources into the AoA Marketplace catalog.

**Architecture:** Keep the existing source-adapter pipeline. Fix the Anthropic adapter to scan the upstream `skills/` directory, and add Microsoft Azure as a verified `github-skills` source using `skillsPath: "skills"` so only the public Azure skill tree is imported.

**Tech Stack:** TypeScript, pnpm, Vitest, Zod, git-backed fixture repositories, existing catalog aggregation scripts.

---

## File Structure

- Modify `catalog/src/sources/anthropic-skills/adapter.ts`
  - Responsibility: clone and normalize Anthropic skills from the current upstream repo layout.
- Modify `catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts`
  - Responsibility: prove Anthropic normalization imports `skills/<slug>/SKILL.md` and skips unrelated root folders.
- Modify `catalog/src/sources/github-skills/__tests__/adapter.test.ts`
  - Responsibility: prove `skillsPath: "skills"` limits imports to that subtree.
- Modify `trusted-sources.json`
  - Responsibility: add `microsoft/azure-skills` as a verified trusted GitHub skills source.
- Optionally inspect `dist/catalog.json` after aggregation
  - Responsibility: generated output only; do not manually edit.

---

### Task 1: Anthropic Adapter Imports `skills/` Directory

**Files:**
- Modify: `catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts`
- Modify: `catalog/src/sources/anthropic-skills/adapter.ts`

- [ ] **Step 1: Write the failing test**

Add filesystem fixture helpers and two tests to `catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts`.

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
```

Add these tests inside `describe("anthropicSkillsAdapter", () => { ... })`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/anthropic-skills/__tests__/adapter.test.ts
```

Expected: the new tests fail because `normalize()` currently scans root-level directories and does not look under `skills/`.

- [ ] **Step 3: Implement the minimal adapter change**

In `catalog/src/sources/anthropic-skills/adapter.ts`, add a helper that chooses the scan root:

```ts
function resolveSkillsRoot(cloneDir: string): { root: string; urlPrefix: string; idPrefix: string } {
  const currentLayout = join(cloneDir, "skills");
  if (existsSync(currentLayout)) {
    return { root: currentLayout, urlPrefix: "skills", idPrefix: "" };
  }
  return { root: cloneDir, urlPrefix: "", idPrefix: "" };
}
```

Then update `normalize()` to use that helper:

```ts
    const { root: skillsRoot, urlPrefix } = resolveSkillsRoot(cloneDir);

    for (const entry of readdirSync(skillsRoot)) {
      const entryPath = join(skillsRoot, entry);
      if (!statSync(entryPath).isDirectory()) continue;
      if (entry.startsWith(".")) continue;

      const skillFile = join(entryPath, "SKILL.md");
      if (!existsSync(skillFile)) {
        ctx.logger.warn(`No SKILL.md in ${entryPath}`);
        continue;
      }

      try {
        const content = readFileSync(skillFile, "utf-8");
        const { name, description, version } = parseFrontmatter(content, entry);
        const sourcePath = urlPrefix ? `${urlPrefix}/${entry}` : entry;
```

Update the item source URL to use `sourcePath`:

```ts
          source: {
            adapter: "anthropic-skills",
            url: `https://github.com/anthropics/skills/tree/main/${sourcePath}`,
            locator: sourcePath,
          },
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/anthropic-skills/__tests__/adapter.test.ts
```

Expected: all Anthropic adapter tests pass.

- [ ] **Step 5: Commit**

```bash
git add catalog/src/sources/anthropic-skills/adapter.ts catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts
git commit -m "fix: import anthropic skills directory"
```

---

### Task 2: GitHub Adapter Test Covers `skillsPath` Boundary

**Files:**
- Modify: `catalog/src/sources/github-skills/__tests__/adapter.test.ts`

- [ ] **Step 1: Write the failing-or-regression test**

Add this test inside `describe("githubSkillsAdapter.normalize", () => { ... })`:

```ts
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
```

- [ ] **Step 2: Run test**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/github-skills/__tests__/adapter.test.ts
```

Expected: this test should pass with the current adapter. If it fails, fix the adapter so `walkSkillFiles()` starts from `join(cloneDir, config.skillsPath)` and does not scan outside that directory.

- [ ] **Step 3: Commit**

```bash
git add catalog/src/sources/github-skills/__tests__/adapter.test.ts
git commit -m "test: cover github skills path boundary"
```

---

### Task 3: Add Microsoft Azure As A Verified Trusted Source

**Files:**
- Modify: `trusted-sources.json`

- [ ] **Step 1: Write the configuration change**

Add this object to the `trustedSources` array in `trusted-sources.json`, after the Anthropic source and before the existing generic GitHub sources:

```json
{
  "adapter": "github-skills",
  "tier": "verified",
  "reason": "Microsoft Azure skills — official Microsoft Azure skills library",
  "config": {
    "repo": "microsoft/azure-skills",
    "ref": "main",
    "skillsPath": "skills",
    "ignore": ["**/node_modules/**", "**/dist/**"],
    "defaultCategory": "engineering"
  }
}
```

- [ ] **Step 2: Run validation**

Run:

```bash
pnpm validate
```

Expected: aggregation completes with zero errors. Output should include a line like:

```text
[github-skills] microsoft/azure-skills: found N SKILL.md files
```

where `N` is greater than zero.

- [ ] **Step 3: Commit**

```bash
git add trusted-sources.json
git commit -m "feat: trust microsoft azure skills"
```

---

### Task 4: Full Catalog Builder Verification

**Files:**
- No production file changes expected.
- `dist/catalog.json` may change when `pnpm aggregate` is run; review it before deciding whether to commit generated output.

- [ ] **Step 1: Run catalog builder tests**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
```

Expected: all catalog builder test files pass.

- [ ] **Step 2: Run catalog validation**

Run:

```bash
pnpm validate
```

Expected:

```text
Errors: 0
Warnings: 0
```

- [ ] **Step 3: Generate catalog output**

Run:

```bash
pnpm aggregate
```

Expected: `dist/catalog.json` is written and contains Anthropic skills under IDs like `skill:anthropic/frontend-design` plus Azure skills under IDs like `skill:github-skills/microsoft/azure-skills/azure-ai`.

- [ ] **Step 4: Inspect catalog counts**

Run:

```powershell
$json = Get-Content -Raw -LiteralPath 'dist\catalog.json' | ConvertFrom-Json
$json.items | Group-Object { $_.source.adapter } | Select-Object Count,Name
$json.items | Where-Object { $_.id -in @('skill:anthropic/frontend-design','skill:github-skills/microsoft/azure-skills/azure-ai') } | Select-Object id,name
```

Expected: both sample IDs are present, and source groups include `anthropic-skills` and `github-skills`.

- [ ] **Step 5: Final commit if generated catalog is tracked**

If `git status --short dist/catalog.json` shows a tracked modification, commit it:

```bash
git add dist/catalog.json
git commit -m "chore: update generated catalog"
```

If `dist/catalog.json` is ignored or unchanged, do not create this commit.

---

## Self-Review Notes

- Spec coverage: Anthropic path fix is Task 1, Azure trusted source is Task 3, existing GitHub behavior is guarded by Task 2, verification is Task 4.
- No skills.sh runtime dependency is added.
- Full `pnpm test` is intentionally not a completion gate because unrelated plugin failures are already known.
- All production behavior changes are covered by tests before implementation or by config validation where the change is data-only.
