# Marketplace Agent Standard Design

## Goal

Make marketplace agents a current, enforced catalog contract without implementing AoA install or runtime behavior in this phase.

Marketplace should define, validate, test, and document agent content so AoA can later consume a stable versioned contract. The contract must support multiple skill and plugin dependencies from day one, while keeping AoA-specific mapping isolated in an optional `aoa` block.

## Scope

This phase is marketplace-only.

In scope:

- Define the agent content layout under `content/agents/{slug}/`.
- Define the catalog-facing `manifest.json` shape for agents.
- Define the runtime-facing `agent.json` shape.
- Add machine validation for agent files and dependency references.
- Add tests and fixtures for valid and invalid agents.
- Update marketplace documentation and agent author workflow.

Out of scope:

- AoA installer dependency resolution.
- AoA database writes for agent install.
- AoA runtime dependency map.
- Plugin secret/config setup flow.
- Agent invocation or runtime execution tests in AoA.

## Current State

The marketplace catalog schema already accepts `type: "agent"` and shared `requires` dependencies. The AoA-curated adapter already scans `content/agents/*/manifest.json` through the generic non-plugin content path and emits a commit-pinned `resourceUrl` to `agent.json`.

The missing pieces are an enforced agent-specific manifest/runtime schema, validation for `agent.json`, catalog-level dependency checks, fixtures, and current-standard documentation.

## Agent Layout

Agent content lives under:

```text
content/agents/{slug}/
  manifest.json
  agent.json
  instructions.md
  README.md
```

Required files:

- `manifest.json`
- `agent.json`

Optional files:

- `instructions.md`, when `agent.json.instructions.type` is `file`
- `README.md`, for marketplace preview or documentation

## Manifest Contract

`manifest.json` remains the canonical catalog contract.

Example:

```json
{
  "id": "agent:aoa-curated/my-agent",
  "name": "My Agent",
  "description": "Does a specific job.",
  "version": "1.0.0",
  "category": "engineering",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "runtime": {
    "entry": "agent.json"
  },
  "capabilities": [
    {
      "id": "issues.triage",
      "description": "Triage issues and recommend next actions."
    }
  ],
  "requires": [
    {
      "type": "skill",
      "id": "skill:github-skills/openai/skills/openai-docs"
    },
    {
      "type": "plugin",
      "id": "plugin:aoa-curated/aoa-plugin-github-issues",
      "versionRange": "^1.0.0"
    }
  ]
}
```

Rules:

- `runtime.entry` is required for agents and must be `agent.json` for `agent.v1`.
- `requires` is canonical for dependency resolution.
- Multiple skill and plugin dependencies are supported.
- `versionRange` is optional, but when present it must be a valid semver range.
- Duplicate dependency IDs are rejected.

## Runtime Contract

`agent.json` is the runtime-facing template. It is versioned independently from the outer catalog schema.

Example:

```json
{
  "schemaVersion": "agent.v1",
  "id": "my-agent",
  "name": "My Agent",
  "description": "Does a specific job.",
  "instructions": {
    "type": "file",
    "path": "instructions.md"
  },
  "dependencies": {
    "skills": {
      "openaiDocs": "skill:github-skills/openai/skills/openai-docs"
    },
    "plugins": {
      "githubIssues": "plugin:aoa-curated/aoa-plugin-github-issues"
    }
  },
  "aoa": {
    "adapterType": "codex_local",
    "runtimeConfig": {},
    "adapterConfig": {},
    "permissions": {},
    "skillKeys": ["skill:github-skills/openai/skills/openai-docs"]
  }
}
```

Required fields:

- `schemaVersion`
- `id`
- `name`
- `description`
- `instructions`

Optional fields:

- `dependencies.skills`
- `dependencies.plugins`
- `aoa`

The `aoa` block is intentionally optional. It gives AoA a place to store adapter hints without making the base agent contract AoA-only.

## Instructions

Agents support inline and file-based instructions in v1.

Inline:

```json
{
  "instructions": {
    "type": "inline",
    "content": "You are responsible for triaging issues."
  }
}
```

File:

```json
{
  "instructions": {
    "type": "file",
    "path": "instructions.md"
  }
}
```

Rules:

- Inline content must be non-empty.
- File path must be safe and relative.
- File path must exist under the agent directory.
- Absolute paths, drive-prefixed paths, empty path segments, `.`, and `..` are rejected.

## Dependency Aliases

`agent.json.dependencies` exists for runtime-friendly aliases. It is not the canonical install contract.

Rules:

- Alias names must match `^[A-Za-z][A-Za-z0-9_]*$`.
- Skill aliases may only reference catalog IDs declared in `manifest.json.requires` with `type: "skill"`.
- Plugin aliases may only reference catalog IDs declared in `manifest.json.requires` with `type: "plugin"`.
- `manifest.json.requires` may include dependencies that are not aliased.
- `agent.json.dependencies` may not reference undeclared dependencies.

## Catalog-Level Dependency Validation

Marketplace aggregation should validate the final deduped catalog dependency graph.

Rules:

- Every `requires[].id` must exist in the generated catalog.
- `requires[].type` must match the referenced item type.
- `requires[].versionRange`, when present, must be a valid semver range.
- If the referenced item has a semver version and a range is provided, the version must satisfy the range.
- Dependency cycles are rejected.

Invalid items should be excluded from the generated catalog with clear error logs. A broken agent should not poison unrelated catalog items.

## Documentation

Update:

- `docs/marketplace/standards/agents.md`
- `docs/marketplace/catalog-schema.md`
- `docs/marketplace/agent-workflows.md`

The docs should say:

- The marketplace agent standard is current and enforced once validation and tests land.
- AoA install/runtime support remains a separate consumer milestone.
- `manifest.json.requires` is canonical.
- `agent.json.dependencies` provides aliases only.
- The `aoa` block is optional and consumer-specific.

## Tests

Test coverage should include:

- Valid agent with multiple skills and plugins emits a catalog item.
- Missing `agent.json` rejects the agent.
- Invalid `agent.json.schemaVersion` rejects the agent.
- Missing instruction file rejects the agent.
- Unsafe instruction path rejects the agent.
- Alias referencing undeclared dependency rejects the agent.
- Missing catalog dependency rejects the dependent item.
- Dependency type mismatch rejects the dependent item.
- Invalid semver range rejects the dependent item.
- Dependency cycle rejects involved items.

## Success Criteria

- Agent-specific schemas exist and are tested.
- AoA-curated adapter validates agent content before emitting agent catalog items.
- Catalog aggregation validates dependency graph references after dedupe.
- Agent documentation is current and names the AoA install/runtime work as a separate phase.
- `pnpm --filter @armyofagents/aoa-marketplace-builder test` passes.
- `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck` passes.
- `pnpm validate` and `pnpm aggregate` complete successfully.
