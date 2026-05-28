# AoA Crew Standard (`aoa-crew.v1`)

## Status

Active. The `aoa-crew.v1` schema is the canonical composition format for the AoA Default Crew team item. It is enforced at install time by the AoA server's team-installer.

## What This Is NOT

Generic teams (`teams.md`) are an open-ended composition concept — founders assemble arbitrary agents into project teams. AoA Crew is different:

- **Fixed composition**: exactly 7 members with designated roles
- **Fixed semantics**: each member has thread-orchestration responsibilities that the AoA discuss-phase runtime depends on
- **System-installed**: installed at company bootstrap, not via the marketplace UI
- **Lifecycle-managed**: crew version bumps go through the `notify` approval path — founders approve updates

Do not conflate AoA Crew with generic teams. They share the `type: "team"` catalog item type but diverge in install behavior, schema, and lifecycle.

## Schema Version

`schemaVersion: "aoa-crew.v1"` appears in `team.json`'s `manifest` field. The AoA team-installer reads this to apply crew-specific install logic (trigger seeding, `kind='aoa'` enforcement).

## File Layout

```
content/teams/{slug}/
  manifest.json   — catalog metadata (id, name, version, requires[])
  team.json       — composition body (slug, agents[], manifest.schemaVersion)
```

`team.json` is the file fetched at install time via `catalogItem.resourceUrl`. `manifest.json` is scanned by the catalog aggregator.

## Required Members (exactly 7)

| Role key      | Agent catalog ID                          | Install order | Trigger kind  |
|---------------|-------------------------------------------|---------------|---------------|
| adjutant      | `agent:aoa-curated/aoa-adjutant`          | 1 (first)     | sweep         |
| scout         | `agent:aoa-curated/aoa-scout`             | 2             | mention       |
| engineer      | `agent:aoa-curated/aoa-engineer`          | 3             | mention       |
| navigator     | `agent:aoa-curated/aoa-navigator`         | 4             | mention       |
| planner       | `agent:aoa-curated/aoa-planner`           | 5             | phase-advance |
| dispatcher    | `agent:aoa-curated/aoa-dispatcher`        | 6             | phase-advance |
| memory-keeper | `agent:aoa-curated/aoa-memory-keeper`     | 7             | outbox        |

## `team.json` Schema

```json
{
  "slug": "aoa-crew",
  "description": "...",
  "manifest": {
    "schemaVersion": "aoa-crew.v1",
    "installOrder": ["adjutant", "scout", "engineer", "navigator", "planner", "dispatcher", "memory-keeper"],
    "adapterCompatibility": {
      "supported": ["process", "codex_local", "claude_local", "gemini_local"],
      "membersInheritWhenSingleChoice": true
    }
  },
  "agents": [
    { "templateOrigin": "agent:aoa-curated/aoa-adjutant", "name": "Adjutant" },
    ...
  ]
}
```

`agents[].templateOrigin` must match the agent catalog item IDs in `requires[]` of `manifest.json`.

## Agent `agent.json` Contract

Each crew agent's `agent.json` must include an `aoa` section with:

```json
"aoa": {
  "adapterType": "process",
  "runtimeConfig": {
    "aoa": {
      "role": "member",
      "instruction": "...",
      "toolAllowlist": ["..."]
    },
    "heartbeat": { "enabled": false, "intervalSec": 0 }
  },
  "kind": "aoa",
  "triggers": [
    { "kind": "mention|phase-advance|outbox|sweep", "enabled": true, "config": { "role": "..." } }
  ]
}
```

- `kind: "aoa"` — causes the team-installer to set `agents.kind = 'aoa'` so the AoA dispatcher recognizes them.
- `triggers` — seeded into `aoa_agent_triggers` at install time, within the same Phase 3 transaction.

## Install Behavior

The AoA server's `team-installer.ts` processes `aoa-crew.v1` items by:

1. Creating a hidden "Crew" internal department (if not exists) as the `targetDepartmentId`.
2. Fetching all 7 agent bodies from their `resourceUrl` (parallel).
3. In a single Postgres transaction: inserting 7 agent rows with `kind='aoa'`, then seeding trigger rows from each agent's `aoa.triggers` array.
4. Inserting the team row and 7 `team_members` links (Adjutant = lead, others = member).

## Update Behavior

Default `teamUpdatePolicy: "notify"`. When a new crew version is published:
- Agents without `agent_config_revisions` entries since install: auto-updated.
- Agents with founder customizations: notify only, founder approves.

## Adapter Override

At bootstrap, the company's chosen adapter (e.g., `codex_local`) is passed as `adapterOverride` to the installer. All 7 crew agents receive the same adapter. Individual per-agent overrides are available post-install via the AgentDetail config tab.
