# Catalog Schema

## Shared Fields

The catalog schema is defined in `catalog/src/types/catalog.ts`. Every item in `dist/catalog.json` is a catalog item with shared fields plus type-specific install or resource metadata.

Shared item fields:

| Field | Meaning |
| --- | --- |
| `id` | Canonical marketplace id. Current ids include prefixes such as `skill:` and `plugin:`. |
| `type` | One of `skill`, `plugin`, `agent`, or `team`. |
| `name` | Human-readable item name. |
| `description` | Human-readable summary. |
| `version` | Item version. Automated checks require valid semver. |
| `source` | Provenance for the adapter and source location. |
| `provider` | Optional resolved provider metadata. Aggregation normally fills this before output. |
| `trust` | Trust tier and review metadata. |
| `status` | One of `active`, `deprecated`, or `quarantined`. |
| `addedAt` | ISO datetime for when the item was added or observed. |
| `capabilities` | Optional list of capability ids and descriptions. |
| `requires` | Optional dependency list, each pointing at another catalog item type and id. |
| `content` | Optional inline content or URL content reference. |
| `category` | Marketplace category enum. |
| `tags` | Marketplace tag enum list. |
| `featured` | Optional boolean for featured placement. |
| `npm` | Optional npm install metadata, currently used for plugins. |
| `resourceUrl` | Optional URL for snapshot content such as skills. |
| `runtimeRequires` | Optional declarative runtime requirements surfaced to users. |
| `skill` | Optional skill bundle and frontmatter metadata. |

The catalog file wrapper includes `schemaVersion`, `generatedAt`, `itemCount`, and `items`.

## Source

`source` records where the item came from:

| Field | Meaning |
| --- | --- |
| `adapter` | Source adapter id, such as `aoa-curated` or `github-skills`. |
| `url` | Informational source URL. |
| `locator` | Adapter-specific locator, such as a repo path or content directory. |
| `commitSha` | Optional commit SHA captured during aggregation. For AoA-curated items this is the marketplace repo commit; imported GitHub skill bundle URLs use the upstream clone commit. |

The main source implementations live under `catalog/src/sources`. Start with `catalog/src/sources/aoa-curated/adapter.ts` for local marketplace plugins and curated content, and `catalog/src/sources/github-skills/adapter.ts` for imported GitHub skill directories.

## Trust

`trust` records review and source confidence:

| Field | Meaning |
| --- | --- |
| `tier` | One of `verified`, `community`, or `unverified`. |
| `source` | Trust source label, often the adapter or source config. |
| `reviewer` | Optional reviewer identifier. |
| `reviewedAt` | Optional review datetime. |
| `reviewedVersion` | Optional reviewed version. |

Trust tier resolution happens in `catalog/src/aggregate.ts` using trusted source data before automated checks and dedupe.

## Provider

`provider` describes the creator or source organization shown to users:

| Field | Meaning |
| --- | --- |
| `id` | Stable provider id using lowercase letters, numbers, and hyphens. |
| `name` | Human-readable provider name. |
| `homepageUrl` | Optional provider homepage. |
| `logoUrl` | Optional provider logo URL. |
| `fallbackInitials` | Short initials used when no logo is available. |

Provider resolution is implemented in `catalog/src/providers/provider-registry.ts`. It reads `content/providers.json`, prefers explicit registry entries, and falls back to GitHub owner metadata when possible.

## Skills

Skill items use `type: "skill"`. Trusted bundles normalized by `catalog/src/sources/github-skills/adapter.ts` and `catalog/src/sources/anthropic-skills/adapter.ts` are the current full bundle paths because they include both `resourceUrl` and `skill.bundle` metadata pinned to the upstream source commit.

The AoA-curated adapter can scan local `content/skills/*/manifest.json`, but that path is not yet a complete active skill bundle path. It currently emits a `resourceUrl` without `skill.bundle`, and automated checks reject skill items that have `resourceUrl` without `skill.bundle`. AoA-curated local skill content needs bundle metadata support before it is treated as an active path.

Skill-specific fields:

| Field | Meaning |
| --- | --- |
| `resourceUrl` | Commit-pinned raw URL for the `SKILL.md` file or canonical skill content. |
| `runtimeRequires` | Optional runtime primitives needed by the skill. |
| `skill.bundle` | Installable GitHub directory metadata. |
| `skill.frontmatter` | Preserved skill frontmatter, including name, description, license, compatibility, metadata, allowed tools, and invocation flags. |

Automated checks in `catalog/src/validators/automated-checks.ts` require a skill with `resourceUrl` to declare `skill.bundle`, require the bundle path to be safe and relative, and warn when `allowedTools` requests broad permissions.

## Plugins

Plugin items use `type: "plugin"`. Current plugin catalog entries are AoA-curated workspace packages normalized by `catalog/src/sources/aoa-curated/adapter.ts`.

Plugin-specific fields:

| Field | Meaning |
| --- | --- |
| `npm.packageName` | Package name used by the plugin installer. |
| `npm.version` | Package version to install. |
| `npm.tarballUrl` | Optional release tarball URL. |
| `capabilities` | Plugin capability ids and human-readable descriptions. |

Automated checks require plugin capability descriptions to be present and long enough to review. Plugins without capabilities produce warnings.

## Agents

Agent items use `type: "agent"`. Agent-specific validation requires `content/agents/{slug}/manifest.json` and `content/agents/{slug}/agent.json`. The catalog item keeps shared fields and a commit-pinned `resourceUrl` to `agent.json`. Bundle instruction files are not separate catalog resources; they are referenced by `agent.json.instructions.files`. Agent dependencies use shared `requires`; runtime aliases live inside `agent.json` and are validated against `requires`.

The AoA-curated adapter validates agent folders with `catalog/src/sources/aoa-curated/agent-content.ts`. `manifest.json.runtime.entry` must be `agent.json`, file-backed instruction paths must be safe relative paths that exist in the agent folder, bundle instruction `entry` and `files` paths must exist in the same agent folder, and runtime dependency aliases may only point at skill or plugin IDs declared in `manifest.json.requires`.

The generated catalog does not embed `agent.json`; it exposes the agent as a shared catalog item and pins `resourceUrl` to `content/agents/{slug}/agent.json` for consumers. For bundle instructions, consumers read `agent.json.instructions.files` to find files such as `AGENTS.md`, `HEARTBEAT.md`, `SOUL.md`, and `TOOLS.md` beside `agent.json`. The marketplace validates that those bundle files exist in the same agent folder. AoA later materializes them into a managed instructions bundle. `manifest.json.requires` remains canonical for install dependencies and dependency graph validation. `agent.json.dependencies` provides runtime aliases only and does not create additional catalog dependencies.

The agent runtime contract may use bundle instructions:

```json
{ "type": "bundle", "entry": "AGENTS.md", "files": ["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"] }
```

Instructions define who the agent is and how it operates. Skills are reusable capability modules declared in `manifest.json.requires` and optionally aliased in `agent.json.dependencies.skills`. Plugins are external integrations declared in `manifest.json.requires` and optionally aliased in `agent.json.dependencies.plugins`. Setup requirements describe installer prompts for required secrets or plugin configuration.

AoA-specific runtime metadata may describe adapter compatibility and setup prompts:

```json
{
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

`aoa.adapterCompatibility` identifies the AoA adapter expectations. `aoa.install` provides optional initial install hints. `aoa.setup` describes what a future installer must collect before the agent can work. `aoa.setup.pluginConfig[].plugin` and `aoa.skillKeys[]` must reference dependencies declared in `manifest.json.requires`. These metadata fields do not install dependencies or make the agent runnable by themselves.

Aggregation runs dependency graph validation after dedupe. Shared `requires` entries must resolve to existing catalog items, match the declared type, use valid semver ranges when present, satisfy semver target versions when possible, avoid duplicates, and avoid cycles. Items with invalid dependency graphs are excluded from catalog output.

The optional `aoa` block in `agent.json` is consumer-specific. AoA install and runtime support remain a separate consumer milestone; catalog validation documents and emits the marketplace contract without claiming AoA can install or run agents yet.

## Teams

Team items use `type: "team"`, and the item type exists in the schema in `catalog/src/types/catalog.ts`. The AoA-curated adapter can scan `content/teams/*/manifest.json` and emit team items with a commit-pinned `resourceUrl`.

The full team standard remains roadmap until importer, installer, dependency, and runtime tests are added. Do not describe team marketplace behavior as current or enforced unless those implementation and test paths exist.

## Agent Checklist

- Inspect `catalog/src/types/catalog.ts` first when documenting fields, enums, or type-specific metadata.
- Inspect `catalog/src/aggregate.ts` when documenting trust resolution, provider resolution, dedupe, or catalog file output.
- Inspect `catalog/src/sources` when documenting how raw content becomes catalog items.
- Inspect `catalog/src/validators/automated-checks.ts` before documenting validation warnings or failures.
- Inspect `catalog/src/providers/provider-registry.ts` before documenting provider fields or fallback behavior.
- Keep agents labeled as a current enforced catalog standard, but do not claim AoA install or runtime support is complete.
- Keep teams labeled as roadmap unless importer, installer, dependency, and runtime tests are added.
- For Task 2 documentation verification, run `rg -n "catalog/src/types/catalog.ts|catalog/src/aggregate.ts|catalog/src/sources" docs/marketplace/architecture.md docs/marketplace/catalog-schema.md`.
- Run `git diff --check` before handing off.
