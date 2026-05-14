# Team Standard

## Status

Teams are roadmap/proposed and not an enforced marketplace standard.

`catalog/src/types/catalog.ts` includes `team` in `ItemTypeSchema`, and `catalog/src/sources/aoa-curated/adapter.ts` can scan `content/teams/*/manifest.json`. That support is not enough to treat teams as current marketplace items. Team composition rules, dependency resolution, importer validation, installer behavior, runtime orchestration, and tests still need product work.

## Current Schema Support

Current shared catalog support includes:

- `type: "team"`.
- Shared fields such as `id`, `name`, `description`, `version`, `source`, `trust`, `status`, `addedAt`, `category`, and `tags`.
- Optional `capabilities`.
- Optional `requires` dependencies.
- Optional `content`.
- Optional `resourceUrl`.

The AoA-curated adapter currently maps team content through the generic `ContentManifest` path and builds a commit-pinned `resourceUrl` to `content/teams/{slug}/team.json`.

## Proposed Composition Shape

A future team composition file should describe members, roles, dependencies, and orchestration rules. A proposed shape:

```json
{
  "id": "team:aoa-curated/example",
  "name": "Example Team",
  "description": "What this team coordinates.",
  "version": "1.0.0",
  "category": "workflows",
  "tags": ["official"],
  "sourceUrl": "https://github.com/MeteoriteLabs/aoa-marketplace",
  "members": [
    {
      "role": "triage",
      "agentId": "agent:aoa-curated/triage-agent"
    },
    {
      "role": "implementation",
      "agentId": "agent:aoa-curated/implementation-agent"
    }
  ],
  "requires": [
    { "type": "agent", "id": "agent:aoa-curated/triage-agent" },
    { "type": "plugin", "id": "plugin:aoa-curated/aoa-plugin-github-issues" }
  ],
  "runtime": {
    "entry": "team.json",
    "orchestration": "sequential"
  }
}
```

This is proposed documentation, not an implemented contract.

## Proposed Dependencies

Team dependencies should eventually use the shared `requires` array from `catalog/src/types/catalog.ts`.

Likely dependency cases:

- Agents that make up the team.
- Skills needed by team members.
- Plugins needed by the team workflow.
- Other teams for nested or delegated workflows, if supported.

Dependency resolution still needs cycle detection, version policy, install ordering, user review, and rollback behavior.

## Runtime Work Needed

Before teams can be enforced marketplace items, AoA needs:

- Final `team.json` schema.
- Composition validation for members, roles, and orchestration.
- Dependency graph validation.
- Installer behavior for team resources and transitive dependencies.
- Runtime orchestration behavior.
- Tests that prove a catalog team can be imported, installed, loaded, and run.

## Before This Becomes Current

Do not label teams as active or enforced until these are complete:

- The composition schema is finalized and documented.
- `catalog/src/sources/aoa-curated/adapter.ts` validates the finalized team fields.
- Automated checks reject invalid team manifests.
- Installer code handles team resources and dependencies.
- Runtime tests cover successful and failed team orchestration.
- Marketplace review policy names required human checks for team composition and dependency behavior.

## Agent Checklist

When working on the future team standard:

1. Inspect `catalog/src/types/catalog.ts`.
2. Inspect `catalog/src/sources/aoa-curated/adapter.ts`.
3. Inspect `catalog/src/validators/automated-checks.ts`.
4. Inspect any `content/teams/*/manifest.json` and `content/teams/*/team.json` files if present.
5. Confirm docs keep the status as roadmap/proposed and not an enforced marketplace standard.
6. For schema or adapter changes, run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
7. For schema or adapter changes, run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
8. For schema or adapter changes, run `pnpm validate`.
9. For schema or adapter changes, run `pnpm aggregate`.
10. Run `git diff --check`.

For docs-only edits to this page, run:

```powershell
rg -n "roadmap/proposed|not an enforced marketplace standard" docs/marketplace/standards/teams.md
git diff --check
```
