# Marketplace Agent Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make marketplace agents a current, enforced catalog contract with schemas, validation, tests, fixtures, and documentation.

**Architecture:** Add focused agent schema/validation helpers to the marketplace catalog builder, keep the AoA-curated adapter responsible for reading local agent files, and add a catalog-level dependency graph validator after aggregation dedupe. Marketplace validates and emits a stable contract; AoA install/runtime behavior remains a later consumer milestone.

**Tech Stack:** TypeScript, Zod, Vitest, semver, pnpm workspace, existing AoA marketplace catalog builder.

---

## File Structure

- Create `catalog/src/types/agent.ts`: Zod schemas and helper types for `agent.json`, agent manifest runtime entry, aliases, and safe relative instruction paths.
- Modify `catalog/src/types/catalog.ts`: extend the generic content manifest support only where shared catalog typing needs to reference agent-specific metadata.
- Create `catalog/src/sources/aoa-curated/agent-content.ts`: file-system validation for `content/agents/{slug}/manifest.json`, `agent.json`, and instruction files.
- Modify `catalog/src/sources/aoa-curated/adapter.ts`: route agent folders through the new agent-specific validator instead of treating them as generic `ContentManifest`.
- Create `catalog/src/validators/dependency-graph.ts`: validate final catalog dependency references, type matches, semver ranges, and cycles.
- Modify `catalog/src/aggregate.ts`: run dependency graph validation after dedupe and exclude invalid dependent items.
- Create and modify tests under `catalog/src/**/__tests__`.
- Modify docs under `docs/marketplace`.

## Task 1: Agent Runtime Schemas

**Files:**

- Create: `catalog/src/types/agent.ts`
- Create: `catalog/src/types/__tests__/agent.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `catalog/src/types/__tests__/agent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AgentRuntimeSchema,
  AgentRuntimeDependencyAliasSchema,
  isSafeAgentRelativePath,
} from "../agent.js";

describe("AgentRuntimeSchema", () => {
  it("accepts an agent.v1 runtime with multiple skill and plugin aliases", () => {
    const parsed = AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "issue-triager",
      name: "Issue Triager",
      description: "Triages issues and proposes next actions.",
      instructions: { type: "file", path: "instructions.md" },
      dependencies: {
        skills: {
          openaiDocs: "skill:github-skills/openai/skills/openai-docs",
          auth0: "skill:github-skills/auth0/skills/auth0",
        },
        plugins: {
          githubIssues: "plugin:aoa-curated/aoa-plugin-github-issues",
          slack: "plugin:aoa-curated/aoa-plugin-slack",
        },
      },
      aoa: {
        adapterType: "codex_local",
        runtimeConfig: {},
        adapterConfig: {},
        permissions: {},
        skillKeys: ["skill:github-skills/openai/skills/openai-docs"],
      },
    });

    expect(parsed.schemaVersion).toBe("agent.v1");
    expect(parsed.dependencies?.skills?.openaiDocs).toContain("openai-docs");
    expect(parsed.dependencies?.plugins?.githubIssues).toContain("github-issues");
  });

  it("accepts inline instructions with non-empty content", () => {
    const parsed = AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "inline-agent",
      name: "Inline Agent",
      description: "Uses inline instructions.",
      instructions: { type: "inline", content: "You triage issues." },
    });

    expect(parsed.instructions.type).toBe("inline");
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      AgentRuntimeSchema.parse({
        schemaVersion: "agent.v2",
        id: "future-agent",
        name: "Future Agent",
        description: "Uses a future schema.",
        instructions: { type: "inline", content: "Hello." },
      }),
    ).toThrow();
  });

  it("rejects invalid dependency alias names", () => {
    expect(() => AgentRuntimeDependencyAliasSchema.parse("github-issues")).toThrow();
    expect(() => AgentRuntimeDependencyAliasSchema.parse("1githubIssues")).toThrow();
    expect(AgentRuntimeDependencyAliasSchema.parse("githubIssues")).toBe("githubIssues");
  });

  it("validates safe relative instruction paths", () => {
    expect(isSafeAgentRelativePath("instructions.md")).toBe(true);
    expect(isSafeAgentRelativePath("docs/instructions.md")).toBe(true);
    expect(isSafeAgentRelativePath("../instructions.md")).toBe(false);
    expect(isSafeAgentRelativePath("/tmp/instructions.md")).toBe(false);
    expect(isSafeAgentRelativePath("C:/tmp/instructions.md")).toBe(false);
    expect(isSafeAgentRelativePath("docs//instructions.md")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/types/__tests__/agent.test.ts
```

Expected: FAIL because `catalog/src/types/agent.ts` does not exist.

- [ ] **Step 3: Implement agent schemas**

Create `catalog/src/types/agent.ts`:

```ts
import { z } from "zod";

export const AGENT_RUNTIME_SCHEMA_VERSION = "agent.v1" as const;

export const AgentRuntimeDependencyAliasSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "alias must start with a letter and contain only letters, numbers, or underscores");

const CatalogDependencyIdSchema = z.string().min(1);

export const AgentInlineInstructionsSchema = z.object({
  type: z.literal("inline"),
  content: z.string().trim().min(1),
});

export const AgentFileInstructionsSchema = z.object({
  type: z.literal("file"),
  path: z.string().trim().min(1),
});

export const AgentInstructionsSchema = z.discriminatedUnion("type", [
  AgentInlineInstructionsSchema,
  AgentFileInstructionsSchema,
]);

export const AgentDependenciesSchema = z.object({
  skills: z.record(AgentRuntimeDependencyAliasSchema, CatalogDependencyIdSchema).optional(),
  plugins: z.record(AgentRuntimeDependencyAliasSchema, CatalogDependencyIdSchema).optional(),
}).optional();

export const AgentAoaHintsSchema = z.object({
  adapterType: z.string().min(1).optional(),
  runtimeConfig: z.record(z.unknown()).optional(),
  adapterConfig: z.record(z.unknown()).optional(),
  permissions: z.record(z.unknown()).optional(),
  skillKeys: z.array(z.string().min(1)).optional(),
}).strict().optional();

export const AgentRuntimeSchema = z.object({
  schemaVersion: z.literal(AGENT_RUNTIME_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  instructions: AgentInstructionsSchema,
  dependencies: AgentDependenciesSchema,
  aoa: AgentAoaHintsSchema,
}).strict();

export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

export function isSafeAgentRelativePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.length === 0) return false;
  if (normalized.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(normalized)) return false;
  if (normalized.includes("\0")) return false;
  return normalized.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function collectAgentRuntimeDependencyIds(runtime: AgentRuntime): {
  skills: string[];
  plugins: string[];
} {
  return {
    skills: Object.values(runtime.dependencies?.skills ?? {}),
    plugins: Object.values(runtime.dependencies?.plugins ?? {}),
  };
}
```

- [ ] **Step 4: Run the schema tests**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/types/__tests__/agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add catalog/src/types/agent.ts catalog/src/types/__tests__/agent.test.ts
git commit -m "feat(catalog): add agent runtime schemas"
```

## Task 2: AoA-Curated Agent File Validation

**Files:**

- Create: `catalog/src/sources/aoa-curated/agent-content.ts`
- Modify: `catalog/src/sources/aoa-curated/adapter.ts`
- Modify: `catalog/src/sources/aoa-curated/__tests__/adapter.test.ts`
- Create fixture files under `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/`

- [ ] **Step 1: Add valid agent fixture**

Create these files:

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/manifest.json`

```json
{
  "id": "agent:aoa-curated/valid-agent",
  "name": "Valid Agent",
  "description": "Valid marketplace agent fixture.",
  "version": "1.0.0",
  "category": "engineering",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "runtime": { "entry": "agent.json" },
  "requires": [
    { "type": "skill", "id": "skill:github-skills/openai/skills/openai-docs" },
    { "type": "skill", "id": "skill:github-skills/auth0/skills/auth0" },
    { "type": "plugin", "id": "plugin:aoa-curated/aoa-plugin-github-issues", "versionRange": "^1.0.0" },
    { "type": "plugin", "id": "plugin:aoa-curated/aoa-plugin-slack", "versionRange": "^1.0.0" }
  ],
  "capabilities": [
    { "id": "issues.triage", "description": "Triage issues and propose next actions." }
  ]
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/agent.json`

```json
{
  "schemaVersion": "agent.v1",
  "id": "valid-agent",
  "name": "Valid Agent",
  "description": "Valid marketplace agent fixture.",
  "instructions": { "type": "file", "path": "instructions.md" },
  "dependencies": {
    "skills": {
      "openaiDocs": "skill:github-skills/openai/skills/openai-docs",
      "auth0": "skill:github-skills/auth0/skills/auth0"
    },
    "plugins": {
      "githubIssues": "plugin:aoa-curated/aoa-plugin-github-issues",
      "slack": "plugin:aoa-curated/aoa-plugin-slack"
    }
  },
  "aoa": {
    "adapterType": "codex_local",
    "runtimeConfig": {},
    "adapterConfig": {},
    "permissions": {},
    "skillKeys": [
      "skill:github-skills/openai/skills/openai-docs",
      "skill:github-skills/auth0/skills/auth0"
    ]
  }
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/instructions.md`

```md
# Valid Agent

Triage issues, inspect the declared tools, and recommend a next action.
```

- [ ] **Step 2: Add adapter tests for valid agent handling**

Append to `catalog/src/sources/aoa-curated/__tests__/adapter.test.ts`:

```ts
describe("aoaCuratedAdapter agent standard", () => {
  it("emits a validated agent item with multiple skill and plugin requirements", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const agent = items.find((i) => i.item.id === "agent:aoa-curated/valid-agent");

    expect(agent).toBeDefined();
    expect(agent!.item.type).toBe("agent");
    expect(agent!.item.resourceUrl).toContain("/content/agents/valid-agent/agent.json");
    expect(agent!.item.requires).toEqual([
      { type: "skill", id: "skill:github-skills/openai/skills/openai-docs" },
      { type: "skill", id: "skill:github-skills/auth0/skills/auth0" },
      { type: "plugin", id: "plugin:aoa-curated/aoa-plugin-github-issues", versionRange: "^1.0.0" },
      { type: "plugin", id: "plugin:aoa-curated/aoa-plugin-slack", versionRange: "^1.0.0" },
    ]);
  });
});
```

- [ ] **Step 3: Run adapter test and verify current behavior**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/adapter.test.ts
```

Expected: FAIL if `runtime.entry` is not accepted by the current generic manifest type or if validation is not implemented.

- [ ] **Step 4: Implement agent file validation helper**

Create `catalog/src/sources/aoa-curated/agent-content.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ItemType } from "../../types/catalog.js";
import {
  AgentRuntimeSchema,
  collectAgentRuntimeDependencyIds,
  isSafeAgentRelativePath,
} from "../../types/agent.js";

const AgentManifestRuntimeSchema = z.object({
  entry: z.literal("agent.json"),
});

export const AgentContentManifestSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  capabilities: z.array(z.object({ id: z.string().min(1), description: z.string().min(1) })).optional(),
  requires: z.array(z.object({
    type: z.custom<ItemType>((value) => ["skill", "plugin", "agent", "team"].includes(String(value))),
    id: z.string().min(1),
    versionRange: z.string().optional(),
  })).optional(),
  contentInline: z.boolean().optional(),
  sourceUrl: z.string().url(),
  license: z.string().optional(),
  featured: z.boolean().optional(),
  runtime: AgentManifestRuntimeSchema,
});

export type AgentContentManifest = z.infer<typeof AgentContentManifestSchema>;

export function loadAndValidateAgentContent(itemDir: string): AgentContentManifest {
  const manifestPath = join(itemDir, "manifest.json");
  const agentPath = join(itemDir, "agent.json");
  if (!existsSync(agentPath)) {
    throw new Error("agent runtime file agent.json is required");
  }

  const manifest = AgentContentManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, "utf-8")),
  );
  const runtime = AgentRuntimeSchema.parse(
    JSON.parse(readFileSync(agentPath, "utf-8")),
  );

  if (runtime.instructions.type === "file") {
    if (!isSafeAgentRelativePath(runtime.instructions.path)) {
      throw new Error(`agent instructions path is unsafe: ${runtime.instructions.path}`);
    }
    const instructionPath = join(itemDir, runtime.instructions.path);
    if (!existsSync(instructionPath)) {
      throw new Error(`agent instructions file not found: ${runtime.instructions.path}`);
    }
  }

  const requiresById = new Map((manifest.requires ?? []).map((req) => [req.id, req.type]));
  const runtimeDeps = collectAgentRuntimeDependencyIds(runtime);
  for (const id of runtimeDeps.skills) {
    if (requiresById.get(id) !== "skill") {
      throw new Error(`agent runtime skill dependency ${id} must be declared in manifest.requires as type skill`);
    }
  }
  for (const id of runtimeDeps.plugins) {
    if (requiresById.get(id) !== "plugin") {
      throw new Error(`agent runtime plugin dependency ${id} must be declared in manifest.requires as type plugin`);
    }
  }

  return manifest;
}
```

- [ ] **Step 5: Route agent folders through the helper**

Modify `catalog/src/sources/aoa-curated/adapter.ts`:

```ts
import { loadAndValidateAgentContent } from "./agent-content.js";
```

Inside the non-plugin content loop, replace the raw JSON parse for agents with:

```ts
if (type === "agent") {
  raw = loadAndValidateAgentContent(itemDir);
} else {
  raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as ContentManifest;
}
```

Extend `ContentManifest` with:

```ts
  runtime?: { entry: string };
```

- [ ] **Step 6: Run adapter tests**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/adapter.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add catalog/src/sources/aoa-curated/agent-content.ts catalog/src/sources/aoa-curated/adapter.ts catalog/src/sources/aoa-curated/__tests__/adapter.test.ts catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents
git commit -m "feat(catalog): validate curated agent content"
```

## Task 3: Invalid Agent Fixture Coverage

**Files:**

- Modify: `catalog/src/sources/aoa-curated/__tests__/adapter.test.ts`
- Create fixture folders under `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/`

- [ ] **Step 1: Add invalid fixtures**

Create:

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/missing-agent-json/manifest.json`

```json
{
  "id": "agent:aoa-curated/missing-agent-json",
  "name": "Missing Agent JSON",
  "description": "Invalid fixture with no agent.json.",
  "version": "1.0.0",
  "category": "engineering",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "runtime": { "entry": "agent.json" }
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/bad-schema-version/manifest.json`

```json
{
  "id": "agent:aoa-curated/bad-schema-version",
  "name": "Bad Schema Version",
  "description": "Invalid fixture with unsupported agent schema.",
  "version": "1.0.0",
  "category": "engineering",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "runtime": { "entry": "agent.json" }
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/bad-schema-version/agent.json`

```json
{
  "schemaVersion": "agent.v2",
  "id": "bad-schema-version",
  "name": "Bad Schema Version",
  "description": "Invalid fixture with unsupported agent schema.",
  "instructions": { "type": "inline", "content": "Hello." }
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/missing-instructions/manifest.json`

```json
{
  "id": "agent:aoa-curated/missing-instructions",
  "name": "Missing Instructions",
  "description": "Invalid fixture with missing instruction file.",
  "version": "1.0.0",
  "category": "engineering",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "runtime": { "entry": "agent.json" }
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/missing-instructions/agent.json`

```json
{
  "schemaVersion": "agent.v1",
  "id": "missing-instructions",
  "name": "Missing Instructions",
  "description": "Invalid fixture with missing instruction file.",
  "instructions": { "type": "file", "path": "instructions.md" }
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/undeclared-alias/manifest.json`

```json
{
  "id": "agent:aoa-curated/undeclared-alias",
  "name": "Undeclared Alias",
  "description": "Invalid fixture with an undeclared runtime alias.",
  "version": "1.0.0",
  "category": "engineering",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "runtime": { "entry": "agent.json" },
  "requires": []
}
```

`catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/undeclared-alias/agent.json`

```json
{
  "schemaVersion": "agent.v1",
  "id": "undeclared-alias",
  "name": "Undeclared Alias",
  "description": "Invalid fixture with an undeclared runtime alias.",
  "instructions": { "type": "inline", "content": "Hello." },
  "dependencies": {
    "skills": {
      "openaiDocs": "skill:github-skills/openai/skills/openai-docs"
    }
  }
}
```

- [ ] **Step 2: Add rejection test**

Append to `catalog/src/sources/aoa-curated/__tests__/adapter.test.ts`:

```ts
  it("skips invalid agent folders and keeps valid agents", async () => {
    const fetched = await aoaCuratedAdapter.fetch(ctx);
    const items = await aoaCuratedAdapter.normalize(fetched, ctx);
    const ids = items.map((entry) => entry.item.id);

    expect(ids).toContain("agent:aoa-curated/valid-agent");
    expect(ids).not.toContain("agent:aoa-curated/missing-agent-json");
    expect(ids).not.toContain("agent:aoa-curated/bad-schema-version");
    expect(ids).not.toContain("agent:aoa-curated/missing-instructions");
    expect(ids).not.toContain("agent:aoa-curated/undeclared-alias");
  });
```

- [ ] **Step 3: Run adapter tests**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/adapter.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add catalog/src/sources/aoa-curated/__tests__/adapter.test.ts catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents
git commit -m "test(catalog): cover invalid agent fixtures"
```

## Task 4: Catalog Dependency Graph Validation

**Files:**

- Create: `catalog/src/validators/dependency-graph.ts`
- Create: `catalog/src/validators/__tests__/dependency-graph.test.ts`
- Modify: `catalog/src/aggregate.ts`

- [ ] **Step 1: Write dependency graph tests**

Create `catalog/src/validators/__tests__/dependency-graph.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../../types/catalog.js";
import { validateCatalogDependencies } from "../dependency-graph.js";

function item(id: string, type: CatalogItem["type"], extra: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    type,
    name: id,
    description: `${id} description`,
    version: "1.0.0",
    source: { adapter: "test", url: "https://example.com", locator: id },
    trust: { tier: "verified", source: "test" },
    status: "active",
    addedAt: "2026-05-14T00:00:00.000Z",
    category: "engineering",
    tags: [],
    ...extra,
  };
}

describe("validateCatalogDependencies", () => {
  it("passes valid multi-dependency agent requirements", () => {
    const result = validateCatalogDependencies([
      item("skill:test/docs", "skill"),
      item("plugin:test/issues", "plugin"),
      item("agent:test/triager", "agent", {
        requires: [
          { type: "skill", id: "skill:test/docs" },
          { type: "plugin", id: "plugin:test/issues", versionRange: "^1.0.0" },
        ],
      }),
    ]);

    expect(result.failuresByItemId.size).toBe(0);
  });

  it("fails missing dependencies", () => {
    const result = validateCatalogDependencies([
      item("agent:test/triager", "agent", {
        requires: [{ type: "skill", id: "skill:test/missing" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("Required catalog item not found");
  });

  it("fails dependency type mismatches", () => {
    const result = validateCatalogDependencies([
      item("plugin:test/issues", "plugin"),
      item("agent:test/triager", "agent", {
        requires: [{ type: "skill", id: "plugin:test/issues" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("type mismatch");
  });

  it("fails invalid semver ranges", () => {
    const result = validateCatalogDependencies([
      item("plugin:test/issues", "plugin"),
      item("agent:test/triager", "agent", {
        requires: [{ type: "plugin", id: "plugin:test/issues", versionRange: "not a range" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("invalid versionRange");
  });

  it("fails unsatisfied semver ranges", () => {
    const result = validateCatalogDependencies([
      item("plugin:test/issues", "plugin", { version: "1.0.0" }),
      item("agent:test/triager", "agent", {
        requires: [{ type: "plugin", id: "plugin:test/issues", versionRange: "^2.0.0" }],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("does not satisfy");
  });

  it("fails duplicate dependency IDs on the same item", () => {
    const result = validateCatalogDependencies([
      item("skill:test/docs", "skill"),
      item("agent:test/triager", "agent", {
        requires: [
          { type: "skill", id: "skill:test/docs" },
          { type: "skill", id: "skill:test/docs" },
        ],
      }),
    ]);

    expect(result.failuresByItemId.get("agent:test/triager")?.[0]).toContain("duplicate dependency");
  });

  it("fails dependency cycles", () => {
    const result = validateCatalogDependencies([
      item("agent:test/a", "agent", { requires: [{ type: "agent", id: "agent:test/b" }] }),
      item("agent:test/b", "agent", { requires: [{ type: "agent", id: "agent:test/a" }] }),
    ]);

    expect(result.failuresByItemId.get("agent:test/a")?.join(" ")).toContain("cycle");
    expect(result.failuresByItemId.get("agent:test/b")?.join(" ")).toContain("cycle");
  });
});
```

- [ ] **Step 2: Run dependency graph tests and verify they fail**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/validators/__tests__/dependency-graph.test.ts
```

Expected: FAIL because `dependency-graph.ts` does not exist.

- [ ] **Step 3: Implement dependency graph validator**

Create `catalog/src/validators/dependency-graph.ts`:

```ts
import semver from "semver";
import type { CatalogItem } from "../types/catalog.js";

export interface DependencyGraphValidationResult {
  failuresByItemId: Map<string, string[]>;
}

function addFailure(map: Map<string, string[]>, itemId: string, message: string): void {
  const existing = map.get(itemId) ?? [];
  existing.push(message);
  map.set(itemId, existing);
}

export function validateCatalogDependencies(items: CatalogItem[]): DependencyGraphValidationResult {
  const failuresByItemId = new Map<string, string[]>();
  const byId = new Map(items.map((item) => [item.id, item]));

  for (const item of items) {
    const seen = new Set<string>();
    for (const req of item.requires ?? []) {
      if (seen.has(req.id)) {
        addFailure(failuresByItemId, item.id, `duplicate dependency: ${req.id}`);
        continue;
      }
      seen.add(req.id);

      const target = byId.get(req.id);
      if (!target) {
        addFailure(failuresByItemId, item.id, `Required catalog item not found: ${req.id}`);
        continue;
      }
      if (target.type !== req.type) {
        addFailure(
          failuresByItemId,
          item.id,
          `Required catalog item type mismatch for ${req.id}: manifest declares ${req.type}, catalog has ${target.type}`,
        );
      }
      if (req.versionRange) {
        if (!semver.validRange(req.versionRange)) {
          addFailure(failuresByItemId, item.id, `invalid versionRange for ${req.id}: ${req.versionRange}`);
        } else if (semver.valid(target.version) && !semver.satisfies(target.version, req.versionRange)) {
          addFailure(
            failuresByItemId,
            item.id,
            `dependency ${req.id}@${target.version} does not satisfy ${req.versionRange}`,
          );
        }
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(item: CatalogItem): void {
    if (visited.has(item.id)) return;
    if (visiting.has(item.id)) {
      const cycleStart = stack.indexOf(item.id);
      const cycle = cycleStart >= 0 ? stack.slice(cycleStart).concat(item.id) : [item.id, item.id];
      for (const id of new Set(cycle)) {
        addFailure(failuresByItemId, id, `dependency cycle detected: ${cycle.join(" -> ")}`);
      }
      return;
    }

    visiting.add(item.id);
    stack.push(item.id);
    for (const req of item.requires ?? []) {
      const target = byId.get(req.id);
      if (target) visit(target);
    }
    stack.pop();
    visiting.delete(item.id);
    visited.add(item.id);
  }

  for (const item of items) visit(item);

  return { failuresByItemId };
}
```

- [ ] **Step 4: Run dependency graph tests**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/validators/__tests__/dependency-graph.test.ts
```

Expected: PASS.

- [ ] **Step 5: Integrate validator into aggregation**

Modify `catalog/src/aggregate.ts`:

```ts
import { validateCatalogDependencies } from "./validators/dependency-graph.js";
```

After `deduped` is created, replace the direct catalog construction with:

```ts
  const dependencyResult = validateCatalogDependencies(deduped);
  const dependencyInvalidIds = dependencyResult.failuresByItemId;
  for (const [itemId, failures] of dependencyInvalidIds) {
    errors.push(`${itemId}: ${failures.join(", ")}`);
    console.error(`[dependency-graph] REJECT ${itemId}: ${failures.join(", ")}`);
  }
  const dependencyChecked = deduped.filter((item) => !dependencyInvalidIds.has(item.id));

  const catalog: CatalogFile = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    itemCount: dependencyChecked.length,
    items: dependencyChecked,
  };
```

Also update later references from `deduped.length` to `dependencyChecked.length` where the aggregation complete count is logged.

- [ ] **Step 6: Add aggregate smoke assertion for dependency-clean output**

Modify the existing `runs end-to-end without crashing` test in `catalog/src/__tests__/aggregate.test.ts` after the existing `catalog.items.every((i) => i.id.length > 0)` assertion:

```ts
    const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
    for (const item of catalog.items) {
      for (const req of item.requires ?? []) {
        const target = itemsById.get(req.id);
        expect(target, `${item.id} requires missing item ${req.id}`).toBeDefined();
        expect(target?.type, `${item.id} declares ${req.id} as ${req.type}`).toBe(req.type);
      }
    }
```

This proves `aggregate()` returns a dependency-clean catalog, while the precise rejection cases remain covered by `dependency-graph.test.ts`.

- [ ] **Step 7: Run relevant tests**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/validators/__tests__/dependency-graph.test.ts src/__tests__/aggregate.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add catalog/src/validators/dependency-graph.ts catalog/src/validators/__tests__/dependency-graph.test.ts catalog/src/aggregate.ts catalog/src/__tests__/aggregate.test.ts
git commit -m "feat(catalog): validate catalog dependency graph"
```

## Task 5: Documentation Standard

**Files:**

- Modify: `docs/marketplace/standards/agents.md`
- Modify: `docs/marketplace/catalog-schema.md`
- Modify: `docs/marketplace/agent-workflows.md`

- [ ] **Step 1: Update agent standard docs**

Replace the roadmap-only status in `docs/marketplace/standards/agents.md` with:

```md
## Status

Agents are a current marketplace catalog standard once validated by the catalog builder. The marketplace standard covers file layout, schemas, dependency declarations, and catalog validation. AoA install and runtime support remain a separate consumer milestone.
```

Add sections for:

```md
## File Layout

```text
content/agents/{slug}/
  manifest.json
  agent.json
  instructions.md
  README.md
```

## Dependency Contract

`manifest.json.requires` is canonical. `agent.json.dependencies` provides runtime aliases and may only reference IDs declared in `manifest.json.requires`.

## AoA Block

The `aoa` block in `agent.json` is optional and consumer-specific. Marketplace validates that it is structured JSON, but AoA decides how to interpret the values later.
```

- [ ] **Step 2: Update catalog schema docs**

In `docs/marketplace/catalog-schema.md`, update the Agents section to document:

```md
Agent-specific validation requires `content/agents/{slug}/manifest.json` and `content/agents/{slug}/agent.json`. The catalog item keeps shared fields and a commit-pinned `resourceUrl` to `agent.json`. Agent dependencies use shared `requires`; runtime aliases live inside `agent.json` and are validated against `requires`.
```

- [ ] **Step 3: Update workflow docs**

In `docs/marketplace/agent-workflows.md`, add an "Adding an Agent" workflow:

```md
## Adding an Agent

1. Create `content/agents/{slug}/manifest.json`.
2. Create `content/agents/{slug}/agent.json`.
3. Add `instructions.md` when `agent.json.instructions.type` is `file`.
4. Declare all install dependencies in `manifest.json.requires`.
5. Add runtime aliases in `agent.json.dependencies` only for dependencies declared in `manifest.json.requires`.
6. Run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
7. Run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
8. Run `pnpm validate`.
9. Run `pnpm aggregate`.
```

- [ ] **Step 4: Run docs checks**

Run:

```powershell
rg -n "manifest.json.requires|agent.json.dependencies|AoA install and runtime support remain" docs/marketplace/standards/agents.md docs/marketplace/catalog-schema.md docs/marketplace/agent-workflows.md
git diff --check
```

Expected: `rg` finds the new standard language and `git diff --check` reports no whitespace errors.

- [ ] **Step 5: Commit**

```powershell
git add docs/marketplace/standards/agents.md docs/marketplace/catalog-schema.md docs/marketplace/agent-workflows.md
git commit -m "docs(marketplace): document agent standard"
```

## Task 6: Full Verification

**Files:**

- Verify all modified files.

- [ ] **Step 1: Run catalog builder test suite**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
```

Expected: PASS.

- [ ] **Step 3: Run marketplace validation**

Run:

```powershell
pnpm validate
```

Expected: command completes successfully. If the generated catalog contains no real agents yet, the validation should still pass.

- [ ] **Step 4: Run aggregation smoke check**

Run:

```powershell
pnpm aggregate
```

Expected: command completes successfully and writes `dist/catalog.json`.

- [ ] **Step 5: Inspect git diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Only intended marketplace agent-standard files are modified.

- [ ] **Step 6: Final commit**

If any verification-only fixes were required, commit them:

```powershell
git add catalog docs
git commit -m "chore(marketplace): verify agent standard"
```
