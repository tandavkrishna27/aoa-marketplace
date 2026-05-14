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
  AGENTS.md
  HEARTBEAT.md
  SOUL.md
  TOOLS.md
  README.md
```

`manifest.json` and `agent.json` are required. `instructions.md` is required when `agent.json.instructions.type` is `file` and the path points at `instructions.md`. AoA agents should prefer bundle instructions with `AGENTS.md` as the entry file and should include every file listed in `agent.json.instructions.files`, commonly `AGENTS.md`, `HEARTBEAT.md`, `SOUL.md`, and `TOOLS.md`. `README.md` is optional marketplace content and may be inlined when the manifest opts into inline content.

Agent content separates four concepts:

- Instructions define who the agent is and how it operates.
- Skills are reusable capability modules the agent can call on.
- Plugins are external integrations the agent can use.
- Setup requirements describe what an installer must collect before the agent can work, such as secrets or plugin configuration.

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
  "instructions": {
    "type": "bundle",
    "entry": "AGENTS.md",
    "files": ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"]
  },
  "dependencies": {
    "skills": {
      "docs": "skill:github-skills/owner/repo/path"
    },
    "plugins": {
      "issues": "plugin:aoa-curated/aoa-plugin-example"
    }
  },
  "aoa": {
    "adapterCompatibility": {
      "recommended": "codex_local",
      "supported": ["codex_local", "claude_local"],
      "requiresInstructionsBundle": true,
      "requiresSkillInjection": true
    },
    "install": {
      "defaultStatus": "paused"
    },
    "setup": {
      "secrets": [
        {
          "key": "ISSUES_API_TOKEN",
          "label": "Issues API token",
          "required": true,
          "reason": "Allows the issues plugin to read and update issue metadata.",
          "usedBy": "issues"
        }
      ],
      "pluginConfig": [
        {
          "plugin": "plugin:aoa-curated/aoa-plugin-example",
          "required": true,
          "reason": "Connect the issues plugin before activating the agent."
        }
      ],
      "notes": [
        "Keep the agent paused until required setup is complete."
      ]
    }
  }
}
```

Runtime fields are strict. `schemaVersion`, `id`, `name`, `description`, and `instructions` are required. Unknown top-level fields are rejected.

## Instructions

Agent instructions may be inline, file-backed, or bundled:

```json
{ "type": "inline", "content": "Triage issues and propose next actions." }
```

```json
{ "type": "file", "path": "instructions.md" }
```

File paths must be safe relative paths inside the agent folder. Absolute paths, drive-letter paths, empty path segments, `.`, `..`, and missing files are rejected.

AoA agents should use bundle instructions:

```json
{ "type": "bundle", "entry": "AGENTS.md", "files": ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"] }
```

The bundle entry identifies the primary instruction file. Every listed file must exist in the same `content/agents/{slug}/` folder. The marketplace validates the file list and path safety; AoA later materializes these files into a managed instructions bundle. This catalog contract does not mean AoA install or runtime support is complete.

## Dependency Contract

`manifest.json.requires` is canonical. `agent.json.dependencies` provides runtime aliases and may only reference IDs declared in `manifest.json.requires`.

Use `manifest.json.requires` for every install dependency that the marketplace must validate and expose. Each entry uses the shared catalog dependency shape:

```json
{ "type": "plugin", "id": "plugin:aoa-curated/aoa-plugin-example", "versionRange": "^1.0.0" }
```

Use `agent.json.dependencies.skills` and `agent.json.dependencies.plugins` only to name dependencies for runtime prompts or loaders. Alias names must start with a letter and contain only letters, numbers, or underscores. Runtime aliases do not add dependencies; they are validated against `manifest.json.requires`.

## AoA Block

The `aoa` block in `agent.json` is optional and consumer-specific. Marketplace validates that it is structured JSON, but AoA decides how to interpret the values later.

Current accepted keys include `adapterCompatibility`, `install`, `setup`, `runtimeConfig`, `adapterConfig`, `permissions`, and `skillKeys`. `adapterType` is accepted only as legacy compatibility input; new agent definitions should use `adapterCompatibility`. These fields are hints for future AoA consumers and do not mean AoA installer or runtime support is complete.

Use `aoa.adapterCompatibility` to declare the suggested adapter families and runtime features an agent expects:

```json
{
  "adapterCompatibility": {
    "recommended": "codex_local",
    "supported": ["codex_local", "claude_local"],
    "requiresInstructionsBundle": true,
    "requiresSkillInjection": true
  }
}
```

Use `aoa.install` for initial install hints that a future consumer may apply:

```json
{
  "install": {
    "defaultRole": "engineering",
    "defaultStatus": "paused",
    "defaultIcon": "wrench"
  }
}
```

Use `aoa.setup` for setup prompts that must be answered before the agent can work:

```json
{
  "setup": {
    "secrets": [
      {
        "key": "ISSUES_API_TOKEN",
        "label": "Issues API token",
        "required": true,
        "reason": "Allows the issues plugin to read and update issue metadata.",
        "usedBy": "issues"
      }
    ],
    "pluginConfig": [
      {
        "plugin": "plugin:aoa-curated/aoa-plugin-example",
        "required": true,
        "reason": "Connect the issues plugin before activating the agent."
      }
    ],
    "notes": [
      "Keep the agent paused until required setup is complete."
    ]
  }
}
```

Setup prompts describe required secrets or plugin configuration for a future installer. `aoa.setup.pluginConfig[].plugin` must point at a plugin declared in `manifest.json.requires`, and every `aoa.skillKeys[]` entry must point at a skill declared in `manifest.json.requires`. Setup metadata does not install plugins, create secrets, or make the agent runnable by itself.

## Validation Rules

The catalog builder enforces:

- `manifest.json` exists and validates as an agent content manifest.
- `agent.json` exists, uses `schemaVersion: "agent.v1"`, and validates against the strict runtime schema.
- `manifest.json.runtime.entry` is exactly `agent.json`.
- File-backed instruction paths are safe relative paths and exist in the agent folder.
- Bundle instruction `entry` and every path in `instructions.files` are safe relative paths and exist in the same agent folder.
- Every `agent.json.dependencies.skills` ID appears in `manifest.json.requires` with `type: "skill"`.
- Every `agent.json.dependencies.plugins` ID appears in `manifest.json.requires` with `type: "plugin"`.
- Every `aoa.skillKeys[]` ID appears in `manifest.json.requires` with `type: "skill"`.
- Every `aoa.setup.pluginConfig[].plugin` ID appears in `manifest.json.requires` with `type: "plugin"`.
- Final catalog dependencies resolve to existing items, match the declared type, use valid semver ranges when present, satisfy target versions when target versions are semver, avoid duplicates, and do not create cycles.
- Agents that fail source validation or dependency graph validation are excluded from the generated catalog.

## Workflow

1. Create `content/agents/{slug}/manifest.json`.
2. Create `content/agents/{slug}/agent.json`.
3. Prefer bundle instructions for AoA agents.
4. Add every bundle file listed in `agent.json.instructions.files`, usually `AGENTS.md`, `HEARTBEAT.md`, `SOUL.md`, and `TOOLS.md`.
5. Declare all install dependencies in `manifest.json.requires`.
6. Add runtime aliases in `agent.json.dependencies` only for dependencies declared in `manifest.json.requires`.
7. Add `aoa.adapterCompatibility` when the agent targets AoA.
8. Add `aoa.setup` for required secrets or plugin configuration.
9. Run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
10. Run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
11. Run `pnpm validate`.
12. Run `pnpm aggregate`.
13. Run `git diff --check`.

## Checklist

- Confirm the agent folder follows the required layout.
- Confirm `manifest.json.requires` is the canonical dependency list.
- Confirm `agent.json.dependencies` contains runtime aliases only.
- Confirm AoA agents use bundle instructions and every `instructions.files` entry exists beside `agent.json`.
- Confirm required setup prompts are documented in `aoa.setup`.
- Confirm any optional `aoa` block is described as consumer-specific.
- Confirm docs and PR text say AoA install and runtime support remain a separate consumer milestone.
