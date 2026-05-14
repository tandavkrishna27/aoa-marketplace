# Agent Standard

## Status

Agents are roadmap/proposed and not an enforced marketplace standard.

`catalog/src/types/catalog.ts` includes `agent` in `ItemTypeSchema`, and `catalog/src/sources/aoa-curated/adapter.ts` can scan `content/agents/*/manifest.json`. That is schema and adapter groundwork, not a complete marketplace standard. Agent manifest shape, importer validation, installer behavior, dependency resolution, and runtime tests still need product work before agents become an active enforced standard.

## Current Schema Support

Current shared catalog support includes:

- `type: "agent"`.
- Shared fields such as `id`, `name`, `description`, `version`, `source`, `trust`, `status`, `addedAt`, `category`, and `tags`.
- Optional `capabilities`.
- Optional `requires` dependencies.
- Optional `content`.
- Optional `resourceUrl`.

The AoA-curated adapter currently maps agent content through the generic `ContentManifest` path and builds a commit-pinned `resourceUrl` to `content/agents/{slug}/agent.json`.

## Proposed Manifest Shape

A future agent manifest should be explicit enough for validation, installation, and runtime loading. A proposed shape:

```json
{
  "id": "agent:aoa-curated/example",
  "name": "Example Agent",
  "description": "What this agent does and when to use it.",
  "version": "1.0.0",
  "category": "productivity",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "capabilities": [
    { "id": "issues.read", "description": "Read AoA issues for task context" }
  ],
  "requires": [
    { "type": "skill", "id": "skill:github-skills/owner/repo/path" },
    { "type": "plugin", "id": "plugin:aoa-curated/aoa-plugin-example" }
  ],
  "runtime": {
    "entry": "agent.json"
  }
}
```

This is proposed documentation, not an implemented contract.

## Proposed Dependencies

Agent dependencies should eventually use the shared `requires` array from `catalog/src/types/catalog.ts`.

Likely dependency cases:

- Skills required for agent behavior.
- Plugins required for external systems or AoA runtime capabilities.
- Other agents required for delegation or routing.

Dependency resolution still needs validation rules, installer behavior, conflict handling, version-range policy, and user-facing install review.

## Runtime Work Needed

Before agents can be enforced marketplace items, AoA needs:

- Final `agent.json` schema.
- Validation beyond generic `ContentManifest`.
- Installer behavior for fetching and placing agent resources.
- Dependency installation and review flow.
- Runtime loader behavior.
- Permission and capability review.
- Tests that prove a catalog agent can be imported, installed, loaded, and invoked.

## Before This Becomes Current

Do not label agents as active or enforced until these are complete:

- The manifest schema is finalized and documented.
- `catalog/src/sources/aoa-curated/adapter.ts` validates the finalized agent fields.
- Automated checks reject invalid agent manifests.
- Installer code handles agent resources and dependencies.
- Runtime tests cover successful and failed agent loading.
- Marketplace review policy names required human checks for agent behavior.

## Agent Checklist

When working on the future agent standard:

1. Inspect `catalog/src/types/catalog.ts`.
2. Inspect `catalog/src/sources/aoa-curated/adapter.ts`.
3. Inspect `catalog/src/validators/automated-checks.ts`.
4. Inspect any `content/agents/*/manifest.json` and `content/agents/*/agent.json` files if present.
5. Confirm docs keep the status as roadmap/proposed and not an enforced marketplace standard.
6. For schema or adapter changes, run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
7. For schema or adapter changes, run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
8. For schema or adapter changes, run `pnpm validate`.
9. For schema or adapter changes, run `pnpm aggregate`.
10. Run `git diff --check`.

For docs-only edits to this page, run:

```powershell
rg -n "roadmap/proposed|not an enforced marketplace standard" docs/marketplace/standards/agents.md
git diff --check
```
