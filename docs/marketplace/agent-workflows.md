# Agent Workflows

Use this page as the operational runbook before changing marketplace sources, provider metadata, AoA-curated plugins, or AoA-curated content. Skills, plugins, and agents are current marketplace catalog surfaces. AoA install and runtime support remain a separate consumer milestone for agents. Teams are roadmap/proposed unless a future standard says otherwise.

## Before Editing

Inspect these files first:

- `docs/marketplace/README.md`
- `docs/marketplace/architecture.md`
- `docs/marketplace/catalog-schema.md`
- `docs/marketplace/trust-and-review.md`
- `docs/marketplace/provider-metadata.md`
- `docs/marketplace/standards/skills.md`
- `docs/marketplace/standards/plugins.md`
- `trusted-sources.json`
- `content/providers.json`

Run these commands:

```powershell
git status --short
rg -n "trusted-sources.json|content/providers.json|catalog/src/sources|catalog/src/validators" docs/marketplace
```

Check for unrelated work before editing. Do not revert changes made by another agent or maintainer. If the work is docs-only, do not edit catalog code, registry JSON, plugin manifests, or package metadata.

## Add A Trusted GitHub Skill Source

Inspect these files:

- `trusted-sources.json`
- `content/providers.json`
- `catalog/src/sources/github-skills/adapter.ts`
- `catalog/src/sources/github-skills/source-config.ts`
- `catalog/src/validators/automated-checks.ts`
- `docs/marketplace/standards/skills.md`
- `docs/marketplace/trust-and-review.md`
- `docs/marketplace/provider-metadata.md`

Workflow:

1. Confirm the upstream repository, branch or tag, skill root, and license posture.
2. Add one `github-skills` entry to `trusted-sources.json` with `adapter`, `tier`, `reason`, and `config`.
3. Set `config.repo`, `config.ref`, `config.skillsPath`, optional `config.ignore`, and optional `config.defaultCategory`.
4. Prefer stable refs when available. If using a moving branch, mention that in the PR.
5. Add or update `content/providers.json` when the repo should have a stable provider display name, homepage, logo URL, or fallback initials.
6. Review broad `allowed-tools` warnings from aggregation instead of treating them as automatic failures.

Run these commands:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
git diff --check
```

## Add Provider Metadata

Inspect these files:

- `content/providers.json`
- `trusted-sources.json`
- `catalog/src/providers/provider-registry.ts`
- `catalog/src/aggregate.ts`
- `docs/marketplace/provider-metadata.md`
- `docs/marketplace/trust-and-review.md`

Workflow:

1. Confirm which GitHub repo or repos should resolve to the provider.
2. Add or update one provider entry in `content/providers.json`.
3. Use a stable lowercase `id`, display `name`, optional `homepageUrl`, optional HTTPS `logoUrl`, concise `fallbackInitials`, and every matching repo in `repos`.
4. Prefer official GitHub avatar URLs for GitHub-sourced providers.
5. Confirm the provider change does not imply a trust upgrade. Trust still comes from `trusted-sources.json` and review.

Run these commands:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
git diff --check
```

## Review Aggregation Warnings

Inspect these files:

- `catalog/src/validators/automated-checks.ts`
- `catalog/src/aggregate.ts`
- `trusted-sources.json`
- `content/providers.json`
- `docs/marketplace/trust-and-review.md`

Workflow:

1. Run aggregation and read every warning and failure.
2. Treat failures as rejected catalog items. Fix the source or explain why the item should not be expected in output.
3. Treat warnings as review prompts. Fix the source when practical, or document accepted warnings in the PR body.
4. Give broad skill `allowed-tools` warnings explicit review. Check the upstream `SKILL.md`, referenced scripts, and why broad access is needed.
5. Re-run aggregation after source, provider, manifest, or validation changes.

Run these commands:

```powershell
pnpm aggregate
pnpm validate
git diff --check
```

If warnings come from a plugin capability or manifest drift issue, also run the plugin package checks listed in the plugin workflow.

## Adding an Agent

Inspect these files:

- `docs/marketplace/standards/agents.md`
- `docs/marketplace/catalog-schema.md`
- `catalog/src/types/agent.ts`
- `catalog/src/sources/aoa-curated/agent-content.ts`
- `catalog/src/sources/aoa-curated/adapter.ts`
- `catalog/src/validators/dependency-graph.ts`

Workflow:

1. Create `content/agents/{slug}/manifest.json`.
2. Create `content/agents/{slug}/agent.json`.
3. Add `instructions.md` when `agent.json.instructions.type` is `file`.
4. Declare all install dependencies in `manifest.json.requires`.
5. Add runtime aliases in `agent.json.dependencies` only for dependencies declared in `manifest.json.requires`.
6. Run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
7. Run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
8. Run `pnpm validate`.
9. Run `pnpm aggregate`.

Notes:

- `manifest.json.requires` is canonical; `agent.json.dependencies` provides runtime aliases only.
- The optional `aoa` block in `agent.json` is consumer-specific. Do not claim AoA install or runtime support is complete.
- The catalog builder validates agent file shape, instruction file safety, runtime aliases, and final dependency graph integrity.

## Add Or Update An AoA Plugin

Inspect these files:

- `plugins/aoa-plugin-discord/manifest.json`
- `plugins/aoa-plugin-*/package.json`
- `plugins/aoa-plugin-*/manifest.json`
- `plugins/aoa-plugin-*/src/manifest.ts`
- `catalog/src/sources/aoa-curated/adapter.ts`
- `catalog/src/validators/manifest-drift.ts`
- `catalog/src/validators/automated-checks.ts`
- `docs/marketplace/standards/plugins.md`

Workflow:

1. Use an existing plugin such as `plugins/aoa-plugin-discord/manifest.json` as the local manifest example.
2. Keep `package.json` and `manifest.json` version fields intentionally aligned.
3. Confirm `manifest.json` has `id`, `displayName`, `description`, `version`, `license`, `capabilities`, `capabilityDescriptions`, and `marketplace` metadata.
4. Confirm every capability has a concrete human-readable description.
5. Build before relying on drift checks, because `catalog/src/validators/manifest-drift.ts` compares against compiled manifest output when it exists.
6. Do not describe agents or teams as active plugin standards. Agents are an enforced catalog standard, not a plugin standard. Teams remain roadmap/proposed unless implementation has changed.

Run these commands, replacing the package name with the plugin being changed:

```powershell
pnpm --filter @armyofagents/aoa-plugin-discord build
pnpm --filter @armyofagents/aoa-plugin-discord typecheck
pnpm --filter @armyofagents/aoa-plugin-discord test
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
git diff --check
```

## Add AoA-Curated Content

Inspect these files:

- `content/`
- `content/skills/`
- `catalog/src/sources/aoa-curated/adapter.ts`
- `catalog/src/types/catalog.ts`
- `catalog/src/validators/automated-checks.ts`
- `content/providers.json`
- `trusted-sources.json`
- `docs/marketplace/catalog-schema.md`
- `docs/marketplace/standards/skills.md`
- `docs/marketplace/architecture.md`

Workflow:

1. Confirm the content path is actually imported by `catalog/src/sources/aoa-curated/adapter.ts`.
2. Match the catalog schema in `catalog/src/types/catalog.ts`.
3. Include provider metadata in `content/providers.json` when display quality depends on an explicit provider.
4. Do not use `content/skills/*` as the active path for new installable skills yet. Local AoA-curated skills are not a complete active skill path while validation rejects skill items that have `resourceUrl` without `skill.bundle`.
5. For skills, use the trusted GitHub skill source workflow unless or until bundle metadata support is implemented for `content/skills`.
6. Run validation before aggregation so schema or manifest failures are visible early.
7. If adding agent content, follow the Adding an Agent workflow and keep AoA installer/runtime claims out of docs and PR text. If adding team-shaped content, label the surface as roadmap/proposed unless importer, installer, dependency, and runtime behavior are all implemented.

Run these commands:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
git diff --check
```

## Verification Commands

For catalog or source changes, run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
```

Also run:

```bash
git diff --check
```

For docs-only changes, run:

```powershell
rg -n "TODO|TBD|coming soon|placeholder" docs/marketplace README.md --glob '!docs/marketplace/agent-workflows.md'
git diff --check
```

For this workflow page, confirm the key operational references are present:

```powershell
rg -n "trusted-sources.json|content/providers.json|pnpm validate|pnpm aggregate|git diff --check" docs/marketplace/agent-workflows.md
```

## PR Checklist

- State whether the PR is docs-only, catalog/source, provider metadata, plugin, or curated content work.
- List the files changed and the marketplace surface affected.
- For trusted source changes, explain the upstream repo, ref, `skillsPath`, trust tier, and review reason from `trusted-sources.json`.
- For provider changes, explain the repo mappings and display metadata added to `content/providers.json`.
- For plugin changes, name the plugin package, version, capabilities reviewed, and drift/build/test commands run.
- For aggregation warnings, list each accepted warning and why it is acceptable.
- For failures, confirm they were fixed or explain why rejected items are expected.
- Keep skills, plugins, and agents described as current catalog standards. Do not claim AoA install or runtime support for agents. Keep teams as roadmap/proposed unless active implementation has landed.
- Include the exact verification commands run and their results.
- Run `git diff --check` after the final edit.
