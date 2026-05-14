# Marketplace Agent Bundle Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the marketplace agent contract so agents can declare AoA-style multi-file instruction bundles, adapter compatibility, install defaults, and setup requirements while keeping skills/plugins as separate dependencies.

**Architecture:** Extend the current `agent.v1` runtime schema instead of introducing `agent.v2`; this is additive because existing `inline` and single `file` instruction shapes remain valid. Keep marketplace-neutral fields focused on identity, instructions, and dependencies; place AoA-specific install/runtime hints under the optional `aoa` object. Source validation remains in the AoA-curated adapter helper, and final dependency validation remains in the catalog dependency graph validator.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm, AoA marketplace catalog builder.

---

## Scope

This plan is marketplace-only. It does not implement AoA install flow, AoA runtime loading, or real sample agents.

Included:

- Add `instructions.type: "bundle"` to `agent.json`.
- Validate all bundle file paths and files.
- Add structured AoA metadata schemas for adapter compatibility, install defaults, runtime defaults, permissions, skill keys, and setup prompts.
- Update fixtures and tests.
- Update marketplace docs for how to create agents.

Excluded:

- Creating real sample agents.
- Installing agents into AoA.
- Prompting for secrets in AoA.
- Running marketplace agents in AoA.

## File Structure

- Modify `catalog/src/types/agent.ts`
  - Owns runtime-facing `agent.json` schemas and helpers.
  - Add bundle instructions and AoA metadata schemas here.

- Modify `catalog/src/types/__tests__/agent.test.ts`
  - Unit tests for schema-only behavior: accepted bundle shape, duplicate files, invalid adapters, setup metadata.

- Modify `catalog/src/sources/aoa-curated/agent-content.ts`
  - Owns filesystem validation for `content/agents/{slug}`.
  - Add validation for every bundle file.

- Modify `catalog/src/sources/aoa-curated/__tests__/agent-content.test.ts`
  - Unit tests for filesystem behavior: missing bundle files, path traversal, directory paths, junction/symlink escape, valid bundle.

- Modify fixture agent:
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/agent.json`
  - Add `AGENTS.md`, `HEARTBEAT.md`, `SOUL.md`, `TOOLS.md` fixture files.

- Add invalid fixture folders:
  - `bundle-missing-entry`
  - `bundle-missing-file`
  - `bundle-unsafe-path`

- Modify `catalog/src/sources/aoa-curated/__tests__/adapter.test.ts`
  - Ensure valid bundle agent is emitted and invalid bundle agents are skipped.

- Modify docs:
  - `docs/marketplace/standards/agents.md`
  - `docs/marketplace/agent-workflows.md`
  - `docs/marketplace/catalog-schema.md`

---

## Contract Decisions

### Instructions vs Skills vs Plugins

Marketplace agents have three separate concepts:

- Instructions bundle: agent identity, behavior, heartbeat process, tool rules.
- Skills: reusable capability modules installed through catalog dependencies.
- Plugins: external integrations installed/enabled through catalog dependencies.

`manifest.json.requires` remains canonical for skills/plugins that AoA needs to install or enable.

### Runtime Shape

Keep the schema version as `agent.v1` and add a third instruction variant:

```json
{
  "instructions": {
    "type": "bundle",
    "entry": "AGENTS.md",
    "files": ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"]
  }
}
```

Existing shapes remain valid:

```json
{ "instructions": { "type": "inline", "content": "..." } }
```

```json
{ "instructions": { "type": "file", "path": "instructions.md" } }
```

### AoA Metadata Shape

All AoA-specific hints live under `aoa`:

```json
{
  "aoa": {
    "adapterCompatibility": {
      "recommended": "codex_local",
      "supported": ["codex_local", "claude_local", "opencode_local", "cursor"],
      "requiresInstructionsBundle": true,
      "requiresSkillInjection": true
    },
    "install": {
      "defaultRole": "lead",
      "defaultStatus": "paused",
      "defaultIcon": "code"
    },
    "runtimeConfig": {
      "heartbeat": {
        "enabled": false,
        "intervalSec": 3600
      }
    },
    "adapterConfig": {},
    "permissions": {
      "canCreateAgents": false
    },
    "skillKeys": [],
    "setup": {
      "secrets": [
        {
          "key": "GITHUB_TOKEN",
          "label": "GitHub token",
          "required": true,
          "reason": "Required to read and update GitHub issues.",
          "usedBy": "plugin:aoa-curated/aoa-plugin-github-issues"
        }
      ],
      "pluginConfig": [
        {
          "plugin": "plugin:aoa-curated/aoa-plugin-github-issues",
          "required": true,
          "reason": "Connect a repository before the agent can triage issues."
        }
      ],
      "notes": ["Install paused until GitHub access is configured."]
    }
  }
}
```

Validation rules:

- `adapterCompatibility.recommended`, when present, must appear in `adapterCompatibility.supported`.
- `adapterCompatibility.supported`, when present, must contain at least one adapter.
- `setup.secrets[].key`, `label`, and `reason` must be non-empty strings.
- `setup.pluginConfig[].plugin` and `reason` must be non-empty strings.
- `install.defaultStatus`, if present, must be one of `active`, `paused`, `terminated`.
- `install.defaultRole`, if present, must be a non-empty string because marketplace should not import AoA shared constants.

---

## Task 1: Schema Tests For Bundle Instructions

**Files:**

- Modify: `catalog/src/types/__tests__/agent.test.ts`
- Modify later: `catalog/src/types/agent.ts`

- [ ] **Step 1: Add failing bundle schema tests**

Add tests to `catalog/src/types/__tests__/agent.test.ts`:

```ts
it("accepts bundle instructions with an entry and multiple files", () => {
  const parsed = AgentRuntimeSchema.parse({
    schemaVersion: "agent.v1",
    id: "bundle-agent",
    name: "Bundle Agent",
    description: "Uses an AoA-style instruction bundle.",
    instructions: {
      type: "bundle",
      entry: "AGENTS.md",
      files: ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"],
    },
  });

  expect(parsed.instructions.type).toBe("bundle");
  if (parsed.instructions.type === "bundle") {
    expect(parsed.instructions.entry).toBe("AGENTS.md");
    expect(parsed.instructions.files).toContain("HEARTBEAT.md");
  }
});

it("rejects bundle instructions when entry is not listed in files", () => {
  expect(() =>
    AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "bad-bundle-agent",
      name: "Bad Bundle Agent",
      description: "Entry is missing from files.",
      instructions: {
        type: "bundle",
        entry: "AGENTS.md",
        files: ["HEARTBEAT.md"],
      },
    }),
  ).toThrow(/entry must be included/i);
});

it("rejects duplicate bundle instruction files", () => {
  expect(() =>
    AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "duplicate-bundle-agent",
      name: "Duplicate Bundle Agent",
      description: "Duplicate file list.",
      instructions: {
        type: "bundle",
        entry: "AGENTS.md",
        files: ["AGENTS.md", "AGENTS.md"],
      },
    }),
  ).toThrow(/duplicate/i);
});
```

- [ ] **Step 2: Run schema tests and verify failure**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/types/__tests__/agent.test.ts
```

Expected: FAIL because `instructions.type: "bundle"` is not in `AgentInstructionsSchema`.

- [ ] **Step 3: Implement bundle instruction schema**

In `catalog/src/types/agent.ts`, add:

```ts
export const AgentBundleInstructionsSchema = z.object({
  type: z.literal("bundle"),
  entry: z.string().trim().min(1),
  files: z.array(z.string().trim().min(1)).min(1),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const file of value.files) {
    if (seen.has(file)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files"],
        message: `duplicate bundle instruction file: ${file}`,
      });
    }
    seen.add(file);
  }
  if (!seen.has(value.entry)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["entry"],
      message: "bundle instruction entry must be included in files",
    });
  }
});
```

Update `AgentInstructionsSchema`:

```ts
export const AgentInstructionsSchema = z.discriminatedUnion("type", [
  AgentInlineInstructionsSchema,
  AgentFileInstructionsSchema,
  AgentBundleInstructionsSchema,
]);
```

- [ ] **Step 4: Run schema tests and verify pass**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/types/__tests__/agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add catalog/src/types/agent.ts catalog/src/types/__tests__/agent.test.ts
git commit -m "feat(catalog): add agent instruction bundle schema"
```

---

## Task 2: Schema Tests For AoA Metadata

**Files:**

- Modify: `catalog/src/types/__tests__/agent.test.ts`
- Modify later: `catalog/src/types/agent.ts`

- [ ] **Step 1: Add failing AoA metadata tests**

Add tests:

```ts
it("accepts AoA adapter compatibility, install hints, and setup requirements", () => {
  const parsed = AgentRuntimeSchema.parse({
    schemaVersion: "agent.v1",
    id: "aoa-metadata-agent",
    name: "AoA Metadata Agent",
    description: "Declares AoA install metadata.",
    instructions: { type: "inline", content: "Hello." },
    aoa: {
      adapterCompatibility: {
        recommended: "codex_local",
        supported: ["codex_local", "claude_local", "opencode_local", "cursor"],
        requiresInstructionsBundle: true,
        requiresSkillInjection: true,
      },
      install: {
        defaultRole: "lead",
        defaultStatus: "paused",
        defaultIcon: "code",
      },
      runtimeConfig: {
        heartbeat: { enabled: false, intervalSec: 3600 },
      },
      adapterConfig: {},
      permissions: { canCreateAgents: false },
      skillKeys: ["skill:github-skills/coderabbitai/skills/code-review"],
      setup: {
        secrets: [
          {
            key: "GITHUB_TOKEN",
            label: "GitHub token",
            required: true,
            reason: "Required to read and update GitHub issues.",
            usedBy: "plugin:aoa-curated/aoa-plugin-github-issues",
          },
        ],
        pluginConfig: [
          {
            plugin: "plugin:aoa-curated/aoa-plugin-github-issues",
            required: true,
            reason: "Connect a repository before the agent can triage issues.",
          },
        ],
        notes: ["Install paused until GitHub access is configured."],
      },
    },
  });

  expect(parsed.aoa?.adapterCompatibility?.recommended).toBe("codex_local");
  expect(parsed.aoa?.setup?.secrets?.[0]?.key).toBe("GITHUB_TOKEN");
});

it("rejects AoA recommended adapter when it is not supported", () => {
  expect(() =>
    AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "bad-adapter-agent",
      name: "Bad Adapter Agent",
      description: "Recommended adapter is not supported.",
      instructions: { type: "inline", content: "Hello." },
      aoa: {
        adapterCompatibility: {
          recommended: "codex_local",
          supported: ["claude_local"],
        },
      },
    }),
  ).toThrow(/recommended adapter must be included/i);
});

it("rejects invalid AoA install status", () => {
  expect(() =>
    AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "bad-status-agent",
      name: "Bad Status Agent",
      description: "Invalid install status.",
      instructions: { type: "inline", content: "Hello." },
      aoa: {
        install: { defaultStatus: "running" },
      },
    }),
  ).toThrow();
});
```

- [ ] **Step 2: Run schema tests and verify failure**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/types/__tests__/agent.test.ts
```

Expected: FAIL because `adapterCompatibility`, `install`, and `setup` are currently unknown strict fields.

- [ ] **Step 3: Implement AoA metadata schemas**

In `catalog/src/types/agent.ts`, add:

```ts
const AgentAdapterIdSchema = z.string().trim().min(1);

export const AgentAoaAdapterCompatibilitySchema = z.object({
  recommended: AgentAdapterIdSchema.optional(),
  supported: z.array(AgentAdapterIdSchema).min(1).optional(),
  requiresInstructionsBundle: z.boolean().optional(),
  requiresSkillInjection: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.recommended && value.supported && !value.supported.includes(value.recommended)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recommended"],
      message: "recommended adapter must be included in supported adapters",
    });
  }
});

export const AgentAoaInstallHintsSchema = z.object({
  defaultRole: z.string().trim().min(1).optional(),
  defaultStatus: z.enum(["active", "paused", "terminated"]).optional(),
  defaultIcon: z.string().trim().min(1).optional(),
}).strict();

export const AgentAoaSetupSecretSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean().optional(),
  reason: z.string().trim().min(1),
  usedBy: z.string().trim().min(1).optional(),
}).strict();

export const AgentAoaSetupPluginConfigSchema = z.object({
  plugin: z.string().trim().min(1),
  required: z.boolean().optional(),
  reason: z.string().trim().min(1),
}).strict();

export const AgentAoaSetupSchema = z.object({
  secrets: z.array(AgentAoaSetupSecretSchema).optional(),
  pluginConfig: z.array(AgentAoaSetupPluginConfigSchema).optional(),
  notes: z.array(z.string().trim().min(1)).optional(),
}).strict();
```

Update `AgentAoaHintsSchema`:

```ts
export const AgentAoaHintsSchema = z.object({
  adapterCompatibility: AgentAoaAdapterCompatibilitySchema.optional(),
  install: AgentAoaInstallHintsSchema.optional(),
  runtimeConfig: z.record(z.unknown()).optional(),
  adapterConfig: z.record(z.unknown()).optional(),
  permissions: z.record(z.unknown()).optional(),
  skillKeys: z.array(z.string().min(1)).optional(),
  setup: AgentAoaSetupSchema.optional(),
}).strict().optional();
```

Keep the old `adapterType` schema field temporarily as deprecated compatibility input. New marketplace docs and fixtures should use `adapterCompatibility`, but accepting `adapterType` avoids rejecting any early `agent.v1` fixtures created from the first agent-standard PR.

```ts
adapterType: z.string().min(1).optional(),
```

Do not document `adapterType` as the preferred field.

- [ ] **Step 4: Run schema tests and verify pass**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/types/__tests__/agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add catalog/src/types/agent.ts catalog/src/types/__tests__/agent.test.ts
git commit -m "feat(catalog): add AoA agent install metadata schema"
```

---

## Task 3: Filesystem Validation For Bundle Instructions

**Files:**

- Modify: `catalog/src/sources/aoa-curated/agent-content.ts`
- Modify: `catalog/src/sources/aoa-curated/__tests__/agent-content.test.ts`

- [ ] **Step 1: Add failing filesystem tests**

Add tests to `agent-content.test.ts`:

```ts
function writeText(dir: string, filename: string, content = `${filename}\n`): void {
  writeFileSync(join(dir, filename), content);
}

it("accepts bundle instructions when every listed file exists", () => {
  const dir = makeItemDir();
  for (const file of ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"]) {
    writeText(dir, file);
  }
  writeJson(dir, "agent.json", {
    ...agent,
    instructions: {
      type: "bundle",
      entry: "AGENTS.md",
      files: ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"],
    },
  });

  expect(loadAndValidateAgentContent(dir).id).toBe("agent:aoa-curated/test-agent");
});

it("throws when a bundle file is missing", () => {
  const dir = makeItemDir();
  writeText(dir, "AGENTS.md");
  writeJson(dir, "agent.json", {
    ...agent,
    instructions: {
      type: "bundle",
      entry: "AGENTS.md",
      files: ["AGENTS.md", "HEARTBEAT.md"],
    },
  });

  expect(() => loadAndValidateAgentContent(dir)).toThrow(/instructions file not found/);
});

it("throws when a bundle file path is unsafe", () => {
  const dir = makeItemDir();
  writeJson(dir, "agent.json", {
    ...agent,
    instructions: {
      type: "bundle",
      entry: "AGENTS.md",
      files: ["AGENTS.md", "../HEARTBEAT.md"],
    },
  });

  expect(() => loadAndValidateAgentContent(dir)).toThrow(/instructions path is unsafe/);
});

it("throws when a bundle file resolves outside the agent directory", () => {
  const dir = makeItemDir();
  writeText(dir, "AGENTS.md");
  const externalDir = mkdtempSync(join(tmpdir(), "agent-content-external-"));
  tempDirs.push(externalDir);
  symlinkSync(externalDir, join(dir, "HEARTBEAT.md"), "junction");
  writeJson(dir, "agent.json", {
    ...agent,
    instructions: {
      type: "bundle",
      entry: "AGENTS.md",
      files: ["AGENTS.md", "HEARTBEAT.md"],
    },
  });

  expect(() => loadAndValidateAgentContent(dir)).toThrow(/instructions path escapes agent directory/);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/agent-content.test.ts
```

Expected: FAIL until bundle filesystem validation is implemented.

- [ ] **Step 3: Refactor single-file validation helper**

In `agent-content.ts`, create:

```ts
function assertAgentInstructionFile(itemDir: string, relativePath: string): void {
  if (!isSafeAgentRelativePath(relativePath)) {
    throw new Error(`agent instructions path is unsafe: ${relativePath}`);
  }
  const instructionPath = join(itemDir, relativePath);
  if (!existsSync(instructionPath)) {
    throw new Error(`agent instructions file not found: ${relativePath}`);
  }
  const realItemDir = realpathSync(itemDir);
  const realInstructionPath = realpathSync(instructionPath);
  const relativeToAgent = relative(realItemDir, realInstructionPath);
  if (
    relativeToAgent === "" ||
    relativeToAgent === ".." ||
    relativeToAgent.startsWith(`..${sep}`) ||
    isAbsolute(relativeToAgent) ||
    relativeToAgent.includes("\0")
  ) {
    throw new Error(`agent instructions path escapes agent directory: ${relativePath}`);
  }
  if (!statSync(instructionPath).isFile()) {
    throw new Error(`agent instructions path is not a file: ${relativePath}`);
  }
}
```

Replace the existing single-file validation block with:

```ts
if (runtime.instructions.type === "file") {
  assertAgentInstructionFile(itemDir, runtime.instructions.path);
}
if (runtime.instructions.type === "bundle") {
  for (const file of runtime.instructions.files) {
    assertAgentInstructionFile(itemDir, file);
  }
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/agent-content.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add catalog/src/sources/aoa-curated/agent-content.ts catalog/src/sources/aoa-curated/__tests__/agent-content.test.ts
git commit -m "feat(catalog): validate agent instruction bundle files"
```

---

## Task 4: Fixture Coverage Through AoA-Curated Adapter

**Files:**

- Modify: `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/agent.json`
- Add:
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/AGENTS.md`
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/HEARTBEAT.md`
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/SOUL.md`
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/valid-agent/TOOLS.md`
- Add invalid fixture folders:
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/bundle-missing-entry/`
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/bundle-missing-file/`
  - `catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents/bundle-unsafe-path/`
- Modify: `catalog/src/sources/aoa-curated/__tests__/adapter.test.ts`

- [ ] **Step 1: Update valid fixture to bundle instructions**

Change valid fixture `agent.json`:

```json
{
  "schemaVersion": "agent.v1",
  "id": "valid-agent",
  "name": "Valid Agent",
  "description": "Valid marketplace agent fixture.",
  "instructions": {
    "type": "bundle",
    "entry": "AGENTS.md",
    "files": ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"]
  },
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
    "adapterCompatibility": {
      "recommended": "codex_local",
      "supported": ["codex_local", "claude_local", "opencode_local", "cursor"],
      "requiresInstructionsBundle": true,
      "requiresSkillInjection": true
    },
    "install": {
      "defaultRole": "lead",
      "defaultStatus": "paused",
      "defaultIcon": "code"
    },
    "runtimeConfig": {
      "heartbeat": { "enabled": false, "intervalSec": 3600 }
    },
    "permissions": { "canCreateAgents": false },
    "setup": {
      "secrets": [
        {
          "key": "GITHUB_TOKEN",
          "label": "GitHub token",
          "required": true,
          "reason": "Required to read and update GitHub issues.",
          "usedBy": "plugin:aoa-curated/aoa-plugin-github-issues"
        }
      ],
      "pluginConfig": [
        {
          "plugin": "plugin:aoa-curated/aoa-plugin-github-issues",
          "required": true,
          "reason": "Connect a repository before the agent can triage issues."
        }
      ],
      "notes": ["Install paused until GitHub access is configured."]
    }
  }
}
```

Create bundle files with short fixture content:

```md
# Valid Agent

Main operating instructions for the valid test agent.
```

```md
# Heartbeat

Run the valid test agent heartbeat checklist.
```

```md
# Soul

Keep fixture behavior stable and boring.
```

```md
# Tools

Use only the declared test dependencies.
```

- [ ] **Step 2: Add invalid fixture manifests**

Each invalid fixture needs a valid `manifest.json` with `runtime.entry: "agent.json"` and an invalid `agent.json`.

`bundle-missing-entry/agent.json`:

```json
{
  "schemaVersion": "agent.v1",
  "id": "bundle-missing-entry",
  "name": "Bundle Missing Entry",
  "description": "Invalid fixture with bundle entry omitted from files.",
  "instructions": {
    "type": "bundle",
    "entry": "AGENTS.md",
    "files": ["HEARTBEAT.md"]
  }
}
```

`bundle-missing-file/agent.json`:

```json
{
  "schemaVersion": "agent.v1",
  "id": "bundle-missing-file",
  "name": "Bundle Missing File",
  "description": "Invalid fixture with missing bundle file.",
  "instructions": {
    "type": "bundle",
    "entry": "AGENTS.md",
    "files": ["AGENTS.md", "HEARTBEAT.md"]
  }
}
```

Create only `AGENTS.md` in that fixture.

`bundle-unsafe-path/agent.json`:

```json
{
  "schemaVersion": "agent.v1",
  "id": "bundle-unsafe-path",
  "name": "Bundle Unsafe Path",
  "description": "Invalid fixture with unsafe bundle path.",
  "instructions": {
    "type": "bundle",
    "entry": "AGENTS.md",
    "files": ["AGENTS.md", "../HEARTBEAT.md"]
  }
}
```

- [ ] **Step 3: Update adapter test expectations**

In `adapter.test.ts`, update invalid IDs:

```ts
expect(ids).not.toContain("agent:aoa-curated/bundle-missing-entry");
expect(ids).not.toContain("agent:aoa-curated/bundle-missing-file");
expect(ids).not.toContain("agent:aoa-curated/bundle-unsafe-path");
```

Keep the existing valid-agent dependency assertions.

- [ ] **Step 4: Run adapter tests**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/adapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add catalog/src/sources/aoa-curated/__tests__/adapter.test.ts catalog/src/sources/aoa-curated/__tests__/fixtures/content/agents
git commit -m "test(catalog): cover agent instruction bundle fixtures"
```

---

## Task 5: Documentation Update

**Files:**

- Modify: `docs/marketplace/standards/agents.md`
- Modify: `docs/marketplace/agent-workflows.md`
- Modify: `docs/marketplace/catalog-schema.md`

- [ ] **Step 1: Update agent standard docs**

In `docs/marketplace/standards/agents.md`, document:

- Folder layout:

```text
content/agents/{slug}/
  manifest.json
  agent.json
  AGENTS.md
  HEARTBEAT.md
  SOUL.md
  TOOLS.md
```

- Concept split:

```md
Instructions define who the agent is and how it operates. Skills are reusable capability modules. Plugins are external integrations. Setup requirements describe what the installer must collect before the agent can work.
```

- Bundle instruction shape:

```json
{
  "type": "bundle",
  "entry": "AGENTS.md",
  "files": ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"]
}
```

- AoA metadata shape with adapter compatibility and setup prompts.

- [ ] **Step 2: Update workflow docs**

In `docs/marketplace/agent-workflows.md`, update “Adding an Agent”:

1. Create `manifest.json`.
2. Create `agent.json`.
3. Prefer bundle instructions for AoA agents.
4. Add every bundle file listed in `agent.json.instructions.files`.
5. Declare skills/plugins in `manifest.json.requires`.
6. Add runtime aliases in `agent.json.dependencies`.
7. Add `aoa.adapterCompatibility` if the agent targets AoA.
8. Add `aoa.setup` for required secrets/plugin config.
9. Run tests, typecheck, validate, aggregate, and `git diff --check`.

- [ ] **Step 3: Update catalog schema docs**

In `docs/marketplace/catalog-schema.md`, update the Agents section:

- `resourceUrl` still points to `agent.json`.
- Bundle files are referenced by `agent.json.instructions.files`.
- Marketplace validates bundle files exist in the same agent folder.
- AoA later materializes bundle files into its managed instructions bundle.
- `manifest.json.requires` remains canonical for install dependencies.

- [ ] **Step 4: Run docs verification**

Run:

```powershell
rg -n "instructions bundle|AGENTS.md|HEARTBEAT.md|SOUL.md|TOOLS.md|adapterCompatibility|setup" docs/marketplace/standards/agents.md docs/marketplace/agent-workflows.md docs/marketplace/catalog-schema.md
git diff --check
```

Expected: `rg` finds the documented terms; `git diff --check` has no output.

- [ ] **Step 5: Commit**

```powershell
git add docs/marketplace/standards/agents.md docs/marketplace/agent-workflows.md docs/marketplace/catalog-schema.md
git commit -m "docs(marketplace): document agent bundle contract"
```

---

## Task 6: Full Verification

**Files:**

- No intended source edits unless verification finds a bug.

- [ ] **Step 1: Run full builder tests**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test
```

Expected: PASS. The final count may change because new tests are added.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
```

Expected: PASS.

- [ ] **Step 3: Run catalog validation**

Run:

```powershell
pnpm validate
```

Expected: PASS with 0 errors. Warning count may remain non-zero because existing catalog warnings are allowed.

- [ ] **Step 4: Run aggregation**

Run:

```powershell
pnpm aggregate
```

Expected: PASS with 0 errors and a written `dist/catalog.json`.

- [ ] **Step 5: Check git hygiene**

Run:

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` has no output. `git status --short` shows only intentional tracked changes before final commit, then clean after commit.

- [ ] **Step 6: Commit verification-only fixes if needed**

Only commit if verification required source/docs changes:

```powershell
git add catalog docs
git commit -m "chore(marketplace): verify agent bundle contract"
```

---

## Review Checklist

Before PR:

- [ ] Existing `inline` instructions still validate.
- [ ] Existing single `file` instructions still validate.
- [ ] Bundle instructions validate schema and filesystem.
- [ ] Bundle entry must be included in files.
- [ ] Bundle files cannot duplicate paths.
- [ ] Bundle files cannot escape the agent folder.
- [ ] AoA adapter compatibility supports multiple adapter choices.
- [ ] Recommended adapter must be in supported adapters.
- [ ] Setup metadata never stores secret values.
- [ ] Docs explain instructions vs skills vs plugins.
- [ ] Docs state AoA installer/runtime support is still separate follow-up work.
- [ ] No real sample agents are added in this PR.

## Plan Self-Review

Spec coverage:

- Instruction bundle support is covered by Tasks 1, 3, 4, and 5.
- AoA adapter compatibility is covered by Task 2 and docs in Task 5.
- Setup/secrets prompts are covered by Task 2 and docs in Task 5.
- Tests are covered at schema, filesystem, adapter, and full-suite levels.
- Sample agents are explicitly excluded and reserved for a later design discussion.

Placeholder scan:

- No implementation steps use unspecified file paths.
- No task says to “add tests” without naming concrete tests.
- No setup metadata stores actual secret values.

Type consistency:

- The plan consistently uses `instructions.type: "bundle"`, `entry`, and `files`.
- The plan consistently uses `aoa.adapterCompatibility`, `aoa.install`, and `aoa.setup`.
- Existing `dependencies.skills` and `dependencies.plugins` remain unchanged.
