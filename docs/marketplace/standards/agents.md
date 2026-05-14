# Agent Standard

## Status

Agents are a current marketplace catalog standard once validated by the catalog builder. The marketplace standard covers file layout, schemas, dependency declarations, and catalog validation. AoA install and runtime support remain a separate consumer milestone.

AoA-curated agent folders are validated by `catalog/src/sources/aoa-curated/agent-content.ts` before they become catalog items. Aggregation also runs dependency graph validation after dedupe, so invalid or unresolved dependencies reject the affected catalog item.

## File Layout

```text
content/agents/{slug}/
  manifest.json
  agent.json
  instructions.md
  README.md
```

`manifest.json` and `agent.json` are required. `instructions.md` is required when `agent.json.instructions.type` is `file` and the path points at `instructions.md`. `README.md` is optional marketplace content and may be inlined when the manifest opts into inline content.

## Manifest Contract

`content/agents/{slug}/manifest.json` describes the catalog item. It uses the shared catalog fields plus an agent runtime pointer:

```json
{
  "id": "agent:aoa-curated/example",
  "name": "Example Agent",
  "description": "What this agent does and when to use it.",
  "version": "1.0.0",
  "category": "productivity",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "runtime": { "entry": "agent.json" },
  "requires": [
    { "type": "skill", "id": "skill:github-skills/owner/repo/path" },
    { "type": "plugin", "id": "plugin:aoa-curated/aoa-plugin-example", "versionRange": "^1.0.0" }
  ],
  "capabilities": [
    { "id": "issues.triage", "description": "Triage issues and propose next actions." }
  ]
}
```

Required fields are `name`, `description`, `version`, `category`, `sourceUrl`, and `runtime.entry`. `runtime.entry` must be `agent.json`. `id` is optional; when omitted, the adapter emits `agent:aoa-curated/{slug}`.

## Runtime Contract

`content/agents/{slug}/agent.json` is the agent runtime contract. The current schema version is `agent.v1`.

```json
{
  "schemaVersion": "agent.v1",
  "id": "example",
  "name": "Example Agent",
  "description": "What this agent does and when to use it.",
  "instructions": { "type": "file", "path": "instructions.md" },
  "dependencies": {
    "skills": {
      "docs": "skill:github-skills/owner/repo/path"
    },
    "plugins": {
      "issues": "plugin:aoa-curated/aoa-plugin-example"
    }
  }
}
```

Runtime fields are strict. `schemaVersion`, `id`, `name`, `description`, and `instructions` are required. Unknown top-level fields are rejected.

## Instructions

Agent instructions may be inline or file-backed:

```json
{ "type": "inline", "content": "Triage issues and propose next actions." }
```

```json
{ "type": "file", "path": "instructions.md" }
```

File paths must be safe relative paths inside the agent folder. Absolute paths, drive-letter paths, empty path segments, `.`, `..`, and missing files are rejected.

## Dependency Contract

`manifest.json.requires` is canonical. `agent.json.dependencies` provides runtime aliases and may only reference IDs declared in `manifest.json.requires`.

Use `manifest.json.requires` for every install dependency that the marketplace must validate and expose. Each entry uses the shared catalog dependency shape:

```json
{ "type": "plugin", "id": "plugin:aoa-curated/aoa-plugin-example", "versionRange": "^1.0.0" }
```

Use `agent.json.dependencies.skills` and `agent.json.dependencies.plugins` only to name dependencies for runtime prompts or loaders. Alias names must start with a letter and contain only letters, numbers, or underscores. Runtime aliases do not add dependencies; they are validated against `manifest.json.requires`.

## AoA Block

The `aoa` block in `agent.json` is optional and consumer-specific. Marketplace validates that it is structured JSON, but AoA decides how to interpret the values later.

Current accepted keys are `adapterType`, `runtimeConfig`, `adapterConfig`, `permissions`, and `skillKeys`. These fields are hints for future AoA consumers and do not mean AoA installer or runtime support is complete.

## Validation Rules

The catalog builder enforces:

- `manifest.json` exists and validates as an agent content manifest.
- `agent.json` exists, uses `schemaVersion: "agent.v1"`, and validates against the strict runtime schema.
- `manifest.json.runtime.entry` is exactly `agent.json`.
- File-backed instruction paths are safe relative paths and exist in the agent folder.
- Every `agent.json.dependencies.skills` ID appears in `manifest.json.requires` with `type: "skill"`.
- Every `agent.json.dependencies.plugins` ID appears in `manifest.json.requires` with `type: "plugin"`.
- Final catalog dependencies resolve to existing items, match the declared type, use valid semver ranges when present, satisfy target versions when target versions are semver, avoid duplicates, and do not create cycles.
- Agents that fail source validation or dependency graph validation are excluded from the generated catalog.

## Workflow

1. Create `content/agents/{slug}/manifest.json`.
2. Create `content/agents/{slug}/agent.json`.
3. Add `instructions.md` when `agent.json.instructions.type` is `file`.
4. Declare all install dependencies in `manifest.json.requires`.
5. Add runtime aliases in `agent.json.dependencies` only for dependencies declared in `manifest.json.requires`.
6. Run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
7. Run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
8. Run `pnpm validate`.
9. Run `pnpm aggregate`.
10. Run `git diff --check`.

## Checklist

- Confirm the agent folder follows the required layout.
- Confirm `manifest.json.requires` is the canonical dependency list.
- Confirm `agent.json.dependencies` contains runtime aliases only.
- Confirm any optional `aoa` block is described as consumer-specific.
- Confirm docs and PR text say AoA install and runtime support remain a separate consumer milestone.
