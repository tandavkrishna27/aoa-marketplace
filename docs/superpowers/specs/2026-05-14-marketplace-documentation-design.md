# Marketplace Documentation Design

## Purpose

The AoA marketplace repo now contains catalog infrastructure, AoA-curated plugins, provider metadata, and imported trusted skills. The repo needs a clear documentation layer so humans and future agents can add sources, plugins, skills, and provider metadata without re-discovering the architecture from TypeScript files.

The documentation should distinguish what is enforced today from what is a roadmap target. Skills and plugins are active marketplace surfaces. Agents and teams exist in the catalog schema, but their full manifest, importer, installer, and runtime behavior still need product work before they can be treated as enforced standards.

## Audiences

The docs should serve three audiences:

1. AoA maintainers reviewing marketplace PRs.
2. Contributors adding trusted sources, providers, plugins, or curated content.
3. Agentic workers that need deterministic runbooks and verification commands.

Each operational page should include an "Agent Checklist" section with exact commands, files to inspect, and review expectations.

## Documentation Structure

Create a new documentation section under:

```text
docs/marketplace/
```

The structure should be:

```text
docs/marketplace/
├── README.md
├── architecture.md
├── catalog-schema.md
├── trust-and-review.md
├── provider-metadata.md
├── agent-workflows.md
└── standards/
    ├── skills.md
    ├── plugins.md
    ├── agents.md
    └── teams.md
```

Update the root `README.md` to point to `docs/marketplace/README.md` as the canonical marketplace docs entrypoint.

## Page Responsibilities

### `docs/marketplace/README.md`

This page is the navigation hub. It should explain what the repo owns, where the generated catalog goes, and which standards are current versus roadmap.

It should not duplicate every standard. It should link to the specific pages and include a short quick-start for common workflows.

### `docs/marketplace/architecture.md`

This page should explain the current aggregation pipeline:

1. Source adapters fetch or scan raw data.
2. Adapters normalize raw data into catalog items.
3. Trust tiers are resolved from `trusted-sources.json`.
4. Provider metadata is resolved from `content/providers.json`.
5. Automated validation accepts, warns, or rejects items.
6. Items are deduped and written to `dist/catalog.json`.
7. CI publishes the generated catalog to the public CDN mirror.

The page should name the key implementation files so future agents can inspect the right code first.

### `docs/marketplace/catalog-schema.md`

This page should document the catalog item fields from `catalog/src/types/catalog.ts` in plain English.

It should cover:

- shared fields on every item
- item type values: `skill`, `plugin`, `agent`, `team`
- trust and provider objects
- plugin-specific `npm`
- skill-specific `resourceUrl` and `skill.bundle`
- roadmap status for agent/team-specific conventions

### `docs/marketplace/trust-and-review.md`

This page should define trust tiers and review policy:

- `verified`
- `community`
- `unverified`

It should explain how `trusted-sources.json` controls imported source trust, how warnings differ from failures, and why broad skill `allowed-tools` warnings matter even when they do not block aggregation.

### `docs/marketplace/provider-metadata.md`

This page should document `content/providers.json`, provider resolution, logo URL expectations, fallback initials, and what to do when a new trusted source does not have a provider mapping.

The first version should keep the current approach: external GitHub avatar URLs are allowed, binary logo assets are not required.

### `docs/marketplace/agent-workflows.md`

This page should be the future-agent runbook. It should include exact workflows for:

- adding a trusted GitHub skill source
- adding provider metadata
- reviewing aggregation warnings
- adding or updating an AoA plugin
- adding AoA-curated content
- running verification before a PR

### `docs/marketplace/standards/skills.md`

This page should document the active skill standard.

It should cover:

- skill directory shape
- required `SKILL.md`
- supported optional files such as `scripts/`, `references/`, and `assets/`
- frontmatter fields the builder preserves
- skill bundle metadata
- installer expectations
- validation and warning behavior

### `docs/marketplace/standards/plugins.md`

This page should document the active plugin standard.

It should cover:

- `plugins/aoa-plugin-X/` workspace shape
- `package.json`
- `manifest.json`
- capability descriptions
- source `manifest.ts` drift checks
- tests, build, and publish expectations

### `docs/marketplace/standards/agents.md`

This page should be labeled as roadmap/proposed.

It should explain that the catalog schema supports `agent`, but AoA still needs a finalized manifest standard, importer validation, installer behavior, dependency resolution, and runtime tests before agents are considered fully supported marketplace items.

### `docs/marketplace/standards/teams.md`

This page should be labeled as roadmap/proposed.

It should explain that the catalog schema supports `team`, but AoA still needs team composition rules, dependency resolution, runtime orchestration behavior, validation, and tests before teams are considered fully supported marketplace items.

## Current Versus Roadmap Standards

The docs should use this classification:

| Surface | Status | Reason |
| --- | --- | --- |
| Skills | Current | Trusted GitHub skills and Anthropic skills are imported, validated, bundled, and installable as full directories. |
| Plugins | Current | AoA plugins are imported from workspace packages and represented with npm install metadata. |
| Agents | Roadmap | Schema support exists, but finalized manifest/import/install/runtime behavior is not complete. |
| Teams | Roadmap | Schema support exists, but finalized composition/import/install/runtime behavior is not complete. |

## Verification

This is a documentation change, so code tests are not the primary proof. The implementation should still run repository-aware checks that prove the docs match current files.

Required verification:

```bash
rg -n "docs/marketplace|trusted-sources.json|content/providers.json|catalog/src/types/catalog.ts" README.md docs/marketplace
rg -n "TODO|TBD|coming soon|placeholder" --glob "!docs/marketplace/agent-workflows.md" docs/marketplace README.md
git diff --check
```

If root README links or markdown cross-links are changed, inspect each referenced path with `Test-Path`.

No `pnpm validate` run is required for docs-only changes unless implementation touches catalog code, `trusted-sources.json`, `content/providers.json`, plugin manifests, or package metadata.

## Success Criteria

- Future agents can identify the canonical marketplace docs entrypoint from the root README.
- Current skills/plugins standards are documented without overstating support.
- Agents/teams are documented as roadmap standards, not active enforced standards.
- Operational pages include agent-oriented checklists.
- The docs name the real source files and verification commands.
- No placeholders or contradictory status labels remain.
