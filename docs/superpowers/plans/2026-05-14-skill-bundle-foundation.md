# Skill Bundle Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make skill catalog entries represent full installable skill directories, not only `SKILL.md` preview records.

**Architecture:** Extend the catalog schema with skill-specific bundle and frontmatter metadata, update parsers/adapters to emit that metadata, and add validators that prove every skill item can be installed as a complete directory. Keep `resourceUrl` for quick `SKILL.md` preview, and add `bundle` for full-directory installation.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm, existing catalog source adapters.

---

## File Structure

- Modify `catalog/src/types/catalog.ts`
  - Add `SkillBundleSchema`, `SkillFrontmatterSchema`, and optional `skill` metadata on skill catalog items.
- Modify `catalog/src/utils/frontmatter.ts`
  - Preserve standard skill frontmatter fields and unknown fields.
- Modify `catalog/src/utils/__tests__/frontmatter.test.ts`
  - Add parser tests for license, compatibility, metadata, allowed-tools, user-invocable, and disable-model-invocation.
- Modify `catalog/src/__tests__/catalog-schema.test.ts`
  - Add schema coverage for skill bundle/frontmatter metadata.
- Modify `catalog/src/sources/github-skills/adapter.ts`
  - Emit `skill.bundle` and `skill.frontmatter` for every GitHub skill.
- Modify `catalog/src/sources/github-skills/__tests__/adapter.test.ts`
  - Add tests for flat, nested, and extra-file bundle fixtures.
- Modify `catalog/src/sources/anthropic-skills/adapter.ts`
  - Capture upstream commit SHA and emit `resourceUrl`, `skill.bundle`, and `skill.frontmatter`.
- Modify `catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts`
  - Add tests for Anthropic bundle metadata.
- Modify `catalog/src/validators/automated-checks.ts`
  - Validate skill bundle path safety and warn on broad `allowed-tools`.
- Modify `catalog/src/validators/__tests__/automated-checks.test.ts`
  - Add validator tests for bundle safety and tool warnings.
- Modify `catalog/src/__tests__/aggregate.test.ts`
  - Add aggregate assertions that every skill item has bundle metadata.

---

### Task 1: Extend Frontmatter Parser

**Files:**
- Modify: `catalog/src/utils/frontmatter.ts`
- Modify: `catalog/src/utils/__tests__/frontmatter.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add tests to `catalog/src/utils/__tests__/frontmatter.test.ts`:

```ts
it("parses standard skill frontmatter fields", () => {
  const content = `---
name: azure-ai
description: Azure AI guidance
version: 1.2.3
license: MIT
compatibility: Requires Azure CLI
allowed-tools: shell web
user-invocable: true
disable-model-invocation: false
metadata:
  provider: Microsoft
  product: Azure
---

# Azure AI
`;

  const parsed = parseFrontmatter(content, "fallback");

  expect(parsed.name).toBe("azure-ai");
  expect(parsed.description).toBe("Azure AI guidance");
  expect(parsed.version).toBe("1.2.3");
  expect(parsed.license).toBe("MIT");
  expect(parsed.compatibility).toBe("Requires Azure CLI");
  expect(parsed.allowedTools).toBe("shell web");
  expect(parsed.userInvocable).toBe(true);
  expect(parsed.disableModelInvocation).toBe(false);
  expect(parsed.metadata).toEqual({ provider: "Microsoft", product: "Azure" });
  expect(parsed.raw["allowed-tools"]).toBe("shell web");
});

it("preserves unknown scalar frontmatter fields in raw", () => {
  const content = `---
name: custom
description: Custom skill
x-provider-slug: provider-x
---

Body.
`;

  const parsed = parseFrontmatter(content, "fallback");

  expect(parsed.raw["x-provider-slug"]).toBe("provider-x");
});
```

- [ ] **Step 2: Run parser tests and confirm RED**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/utils/__tests__/frontmatter.test.ts
```

Expected: tests fail because these fields are not parsed yet.

- [ ] **Step 3: Implement parser support**

Update `FrontmatterFields` in `catalog/src/utils/frontmatter.ts`:

```ts
export interface FrontmatterFields {
  name: string;
  description: string;
  version: string;
  category?: string;
  tags?: string[];
  runtimeRequires?: string[];
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  raw: Record<string, unknown>;
}
```

Extend `parseFrontmatter()` with small YAML-ish helpers:

```ts
const raw: Record<string, unknown> = {};
const lines = fm.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const scalar = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
  if (!scalar) continue;
  const key = scalar[1];
  const value = scalar[2].trim().replace(/^["']|["']$/g, "");
  if (value.length > 0) raw[key] = value;
}
```

Add metadata parsing for simple indented key-value blocks:

```ts
const getMap = (key: string): Record<string, string> | undefined => {
  const start = lines.findIndex((line) => line.match(new RegExp(`^${key}:\\s*$`)));
  if (start === -1) return undefined;
  const out: Record<string, string> = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("  ")) break;
    const m = line.trim().match(/^([^:]+):\s*(.+)$/);
    if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return Object.keys(out).length > 0 ? out : undefined;
};
```

Return the new fields:

```ts
const metadata = getMap("metadata");
if (metadata) raw.metadata = metadata;

return {
  name: get("name") ?? fallbackName,
  description: get("description") ?? fallbackName,
  version: get("version") ?? "1.0.0",
  category: get("category"),
  tags: getList("tags"),
  runtimeRequires: getList("runtimeRequires"),
  license: get("license"),
  compatibility: get("compatibility"),
  metadata,
  allowedTools: get("allowed-tools"),
  userInvocable: parseBoolean(get("user-invocable")),
  disableModelInvocation: parseBoolean(get("disable-model-invocation")),
  raw,
};
```

Add helper:

```ts
function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}
```

When there is no frontmatter, return `raw: {}`.

- [ ] **Step 4: Run parser tests and confirm GREEN**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/utils/__tests__/frontmatter.test.ts
```

Expected: parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add catalog/src/utils/frontmatter.ts catalog/src/utils/__tests__/frontmatter.test.ts
git commit -m "feat: preserve skill frontmatter metadata"
```

---

### Task 2: Add Skill Bundle Schema

**Files:**
- Modify: `catalog/src/types/catalog.ts`
- Modify: `catalog/src/__tests__/catalog-schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add to `catalog/src/__tests__/catalog-schema.test.ts`:

```ts
it("accepts skill bundle and frontmatter metadata", () => {
  const item = {
    id: "skill:github-skills/microsoft/azure-skills/azure-ai",
    type: "skill",
    name: "azure-ai",
    description: "Azure AI guidance",
    version: "1.0.0",
    source: {
      adapter: "github-skills",
      url: "https://github.com/microsoft/azure-skills/tree/abc123/skills/azure-ai",
      locator: "microsoft/azure-skills/skills/azure-ai",
      commitSha: "catalogsha",
    },
    resourceUrl: "https://raw.githubusercontent.com/microsoft/azure-skills/abc123/skills/azure-ai/SKILL.md",
    trust: { tier: "verified", source: "github-skills" },
    status: "active",
    addedAt: "2026-05-14T00:00:00.000Z",
    category: "engineering",
    tags: [],
    skill: {
      bundle: {
        type: "github-directory",
        repo: "microsoft/azure-skills",
        commitSha: "abc123",
        path: "skills/azure-ai",
        treeUrl: "https://github.com/microsoft/azure-skills/tree/abc123/skills/azure-ai",
      },
      frontmatter: {
        name: "azure-ai",
        description: "Azure AI guidance",
        license: "MIT",
        compatibility: "Requires Azure CLI",
        allowedTools: "shell",
        metadata: { provider: "Microsoft" },
        raw: { license: "MIT", metadata: { provider: "Microsoft" } },
      },
    },
  };

  expect(() => CatalogItemSchema.parse(item)).not.toThrow();
});
```

- [ ] **Step 2: Run schema tests and confirm RED**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/__tests__/catalog-schema.test.ts
```

Expected: schema rejects unknown `skill` metadata.

- [ ] **Step 3: Implement schema**

Add to `catalog/src/types/catalog.ts`:

```ts
export const SkillBundleSchema = z.object({
  type: z.literal("github-directory"),
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  commitSha: z.string().min(7),
  path: z.string().min(1),
  treeUrl: z.string().url(),
});

export const SkillFrontmatterSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  allowedTools: z.string().optional(),
  userInvocable: z.boolean().optional(),
  disableModelInvocation: z.boolean().optional(),
  raw: z.record(z.unknown()).default({}),
});

export const SkillMetadataSchema = z.object({
  bundle: SkillBundleSchema,
  frontmatter: SkillFrontmatterSchema,
});
```

Add to `CatalogItemSchema`:

```ts
  skill: SkillMetadataSchema.optional(),
```

Export inferred types:

```ts
export type SkillBundle = z.infer<typeof SkillBundleSchema>;
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;
```

- [ ] **Step 4: Run schema tests and confirm GREEN**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/__tests__/catalog-schema.test.ts
```

Expected: schema tests pass.

- [ ] **Step 5: Commit**

```bash
git add catalog/src/types/catalog.ts catalog/src/__tests__/catalog-schema.test.ts
git commit -m "feat: add skill bundle catalog schema"
```

---

### Task 3: Emit Bundles From GitHub Skills Adapter

**Files:**
- Modify: `catalog/src/sources/github-skills/adapter.ts`
- Modify: `catalog/src/sources/github-skills/__tests__/adapter.test.ts`

- [ ] **Step 1: Write failing adapter tests**

In `catalog/src/sources/github-skills/__tests__/adapter.test.ts`, update the existing flat-skill normalize test to assert bundle fields:

```ts
expect(foo!.item.skill?.bundle).toEqual({
  type: "github-directory",
  repo: "local/fake",
  commitSha: expect.stringMatching(/^[a-f0-9]{7,40}$/),
  path: "skills/foo",
  treeUrl: expect.stringMatching(/^https:\/\/github\.com\/local\/fake\/tree\/[a-f0-9]{7,40}\/skills\/foo$/),
});
expect(foo!.item.skill?.frontmatter.license).toBeUndefined();
expect(foo!.item.skill?.frontmatter.raw.name).toBe("foo");
```

Add a new test:

```ts
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
```

Update the nested skill test to assert deepest bundle path:

```ts
expect(deepest.item.skill?.bundle.path).toBe("skills/microsoft-foundry/models/deploy-model/capacity");
```

- [ ] **Step 2: Run GitHub adapter tests and confirm RED**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/github-skills/__tests__/adapter.test.ts
```

Expected: tests fail because `item.skill` does not exist.

- [ ] **Step 3: Implement GitHub adapter bundle emission**

In `catalog/src/sources/github-skills/adapter.ts`, after parsing frontmatter:

```ts
const skillPath = relPath.replace(/\/SKILL\.md$/, "");
const treeUrl = `https://github.com/${src.config.repo}/tree/${sha}/${skillPath}`;
```

Add to the catalog item:

```ts
skill: {
  bundle: {
    type: "github-directory",
    repo: src.config.repo,
    commitSha: sha,
    path: skillPath,
    treeUrl,
  },
  frontmatter: {
    name: fm.name,
    description: fm.description,
    license: fm.license,
    compatibility: fm.compatibility,
    metadata: fm.metadata,
    allowedTools: fm.allowedTools,
    userInvocable: fm.userInvocable,
    disableModelInvocation: fm.disableModelInvocation,
    raw: fm.raw,
  },
},
```

Also reuse `treeUrl` in `source.url` to keep URLs consistent:

```ts
url: treeUrl,
```

- [ ] **Step 4: Run GitHub adapter tests and confirm GREEN**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/github-skills/__tests__/adapter.test.ts
```

Expected: adapter tests pass.

- [ ] **Step 5: Commit**

```bash
git add catalog/src/sources/github-skills/adapter.ts catalog/src/sources/github-skills/__tests__/adapter.test.ts
git commit -m "feat: emit github skill bundle metadata"
```

---

### Task 4: Emit Bundles From Anthropic Adapter

**Files:**
- Modify: `catalog/src/sources/anthropic-skills/adapter.ts`
- Modify: `catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts`

- [ ] **Step 1: Write failing Anthropic tests**

Update fixture tests in `catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts` to provide `sourceCommitSha`:

```ts
const items = await anthropicSkillsAdapter.normalize(
  {
    cloneDir,
    cloneTimestamp: "2026-05-14T00:00:00.000Z",
    sourceCommitSha: "abc1234567890fedcba9876543210fedcba98765",
  },
  ctx,
);
```

Add assertions:

```ts
expect(items[0].item.resourceUrl).toBe(
  "https://raw.githubusercontent.com/anthropics/skills/abc1234567890fedcba9876543210fedcba98765/skills/frontend-design/SKILL.md",
);
expect(items[0].item.skill?.bundle).toEqual({
  type: "github-directory",
  repo: "anthropics/skills",
  commitSha: "abc1234567890fedcba9876543210fedcba98765",
  path: "skills/frontend-design",
  treeUrl: "https://github.com/anthropics/skills/tree/abc1234567890fedcba9876543210fedcba98765/skills/frontend-design",
});
expect(items[0].item.skill?.frontmatter.raw.name).toBe("frontend-design");
```

- [ ] **Step 2: Run Anthropic adapter tests and confirm RED**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/anthropic-skills/__tests__/adapter.test.ts
```

Expected: tests fail because Anthropic items do not emit `resourceUrl` or `skill.bundle`.

- [ ] **Step 3: Capture source commit SHA in fetch**

Update `FetchedRepo`:

```ts
interface FetchedRepo {
  cloneDir: string;
  cloneTimestamp: string;
  sourceCommitSha: string;
}
```

In `fetch()`, after clone succeeds:

```ts
const shaResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: cloneDir, encoding: "utf-8" });
const sourceCommitSha = shaResult.stdout.trim();
return { cloneDir, cloneTimestamp: new Date().toISOString(), sourceCommitSha };
```

Update `normalize()` destructuring:

```ts
const { cloneDir, cloneTimestamp, sourceCommitSha } = raw as FetchedRepo;
```

- [ ] **Step 4: Emit Anthropic bundle metadata**

After `sourcePath`:

```ts
const treeUrl = `https://github.com/anthropics/skills/tree/${sourceCommitSha}/${sourcePath}`;
const resourceUrl = `https://raw.githubusercontent.com/anthropics/skills/${sourceCommitSha}/${sourcePath}/SKILL.md`;
```

Update item:

```ts
source: {
  adapter: "anthropic-skills",
  url: treeUrl,
  locator: sourcePath,
},
resourceUrl,
skill: {
  bundle: {
    type: "github-directory",
    repo: "anthropics/skills",
    commitSha: sourceCommitSha,
    path: sourcePath,
    treeUrl,
  },
  frontmatter: {
    name,
    description,
    license: fm.license,
    compatibility: fm.compatibility,
    metadata: fm.metadata,
    allowedTools: fm.allowedTools,
    userInvocable: fm.userInvocable,
    disableModelInvocation: fm.disableModelInvocation,
    raw: fm.raw,
  },
},
```

Use `const fm = parseFrontmatter(content, entry);` instead of destructuring directly so these fields are available.

- [ ] **Step 5: Run Anthropic adapter tests and confirm GREEN**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/anthropic-skills/__tests__/adapter.test.ts
```

Expected: tests pass.

- [ ] **Step 6: Commit**

```bash
git add catalog/src/sources/anthropic-skills/adapter.ts catalog/src/sources/anthropic-skills/__tests__/adapter.test.ts
git commit -m "feat: emit anthropic skill bundle metadata"
```

---

### Task 5: Add Bundle Validation

**Files:**
- Modify: `catalog/src/validators/automated-checks.ts`
- Modify: `catalog/src/validators/__tests__/automated-checks.test.ts`

- [ ] **Step 1: Write failing validator tests**

Add tests to `catalog/src/validators/__tests__/automated-checks.test.ts`:

```ts
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
```

Use or create a `validSkillItem` fixture with required catalog fields.

- [ ] **Step 2: Run automated checks tests and confirm RED**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/validators/__tests__/automated-checks.test.ts
```

Expected: new validator tests fail because checks do not exist.

- [ ] **Step 3: Implement validation**

In `catalog/src/validators/automated-checks.ts`, add:

```ts
if (item.type === "skill") {
  if (item.resourceUrl && !item.skill?.bundle) {
    failures.push("skill item with resourceUrl must declare skill.bundle");
  }
  const path = item.skill?.bundle.path;
  if (path !== undefined) {
    const normalized = path.replace(/\\/g, "/");
    if (
      normalized.startsWith("/") ||
      normalized.includes("../") ||
      normalized === ".." ||
      normalized.includes("\0")
    ) {
      failures.push("skill.bundle.path must be a safe relative path");
    }
  }
  const allowedTools = item.skill?.frontmatter.allowedTools;
  if (allowedTools && /(^|\s)(\*|shell|bash|cmd|powershell)(\s|$)/i.test(allowedTools)) {
    warnings.push("Skill requests broad allowed-tools permissions");
  }
}
```

- [ ] **Step 4: Run automated checks tests and confirm GREEN**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/validators/__tests__/automated-checks.test.ts
```

Expected: automated checks tests pass.

- [ ] **Step 5: Commit**

```bash
git add catalog/src/validators/automated-checks.ts catalog/src/validators/__tests__/automated-checks.test.ts
git commit -m "feat: validate skill bundle metadata"
```

---

### Task 6: Aggregate Guarantees For Existing Trusted Skills

**Files:**
- Modify: `catalog/src/__tests__/aggregate.test.ts`

- [ ] **Step 1: Write failing aggregate assertions**

In the end-to-end aggregate test, after `const catalog = await aggregate({ validateOnly: true });`, add:

```ts
const skillItems = catalog.items.filter((item) => item.type === "skill");
expect(skillItems.length).toBeGreaterThan(0);
expect(skillItems.every((item) => item.skill?.bundle !== undefined)).toBe(true);
expect(skillItems.every((item) => item.resourceUrl !== undefined)).toBe(true);

const anthropicFrontend = catalog.items.find((item) => item.id === "skill:anthropic/frontend-design");
expect(anthropicFrontend?.skill?.bundle.path).toBe("skills/frontend-design");

const azureNested = catalog.items.find(
  (item) => item.id === "skill:github-skills/microsoft/azure-skills/microsoft-foundry/models/deploy-model/capacity",
);
expect(azureNested?.skill?.bundle.path).toBe("skills/microsoft-foundry/models/deploy-model/capacity");
```

If this test runs without network in some environments, keep existing `itemCount >= 0` behavior but wrap source-specific assertions in:

```ts
if (catalog.items.some((item) => item.source.adapter === "anthropic-skills")) {
  // source-specific checks
}
```

- [ ] **Step 2: Run aggregate test and confirm RED or regression coverage**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/__tests__/aggregate.test.ts
```

Expected before all adapter tasks are complete: this fails because some skill items lack bundle metadata. If it already passes after prior tasks, keep it as regression coverage.

- [ ] **Step 3: Fix any remaining aggregate gaps**

If any skill item lacks bundle metadata:

- inspect the source adapter that produced it
- emit `skill.bundle`
- run the focused adapter test first
- rerun aggregate test

- [ ] **Step 4: Run aggregate test and confirm GREEN**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/__tests__/aggregate.test.ts
```

Expected: aggregate tests pass.

- [ ] **Step 5: Commit**

```bash
git add catalog/src/__tests__/aggregate.test.ts
git commit -m "test: require bundles for aggregated skills"
```

---

### Task 7: Final Verification

**Files:**
- No additional file changes expected.

- [ ] **Step 1: Run catalog builder tests**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
```

Expected: all catalog builder tests pass.

- [ ] **Step 2: Run validation**

Run:

```bash
pnpm validate
```

Expected:

```text
Errors: 0
```

Warnings may appear for broad `allowed-tools`; if warnings appear, review and decide whether they are acceptable. The preferred result is zero errors and only intentional warnings.

- [ ] **Step 3: Generate catalog**

Run:

```bash
pnpm aggregate
```

Expected: catalog writes successfully.

- [ ] **Step 4: Inspect generated catalog**

Run:

```powershell
$json = Get-Content -Raw -LiteralPath 'dist\catalog.json' | ConvertFrom-Json
$skills = @($json.items | Where-Object { $_.type -eq 'skill' })
$skills.Count
@($skills | Where-Object { -not $_.skill.bundle }).Count
$json.items | Where-Object { $_.id -in @(
  'skill:anthropic/frontend-design',
  'skill:github-skills/microsoft/azure-skills/azure-ai',
  'skill:github-skills/microsoft/azure-skills/microsoft-foundry/models/deploy-model/capacity'
) } | Select-Object id,@{Name='bundlePath';Expression={$_.skill.bundle.path}},resourceUrl
```

Expected:

- skill count is greater than zero
- missing bundle count is `0`
- sample items show correct bundle paths and `resourceUrl`

- [ ] **Step 5: Do not commit generated catalog unless tracked**

Run:

```bash
git status --short dist/catalog.json
```

If ignored or unchanged, do not commit `dist/catalog.json`.

---

## Self-Review Notes

- Spec coverage: bundle schema, frontmatter preservation, GitHub/Anthropic adapter output, validation, and aggregate guarantee are covered.
- The plan keeps install-root support out of catalog item implementation; installation belongs in AoA after bundle metadata exists.
- The plan preserves `resourceUrl` for browsing and adds `skill.bundle` for installation.
- The plan does not import new providers.
- Full monorepo `pnpm test` remains out of scope because unrelated plugin-package failures already exist.
