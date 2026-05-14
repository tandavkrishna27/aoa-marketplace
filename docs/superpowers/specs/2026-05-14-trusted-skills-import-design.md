# Trusted Skills Import Design

## Purpose

AoA Marketplace should import all skills from sources we explicitly trust, so the catalog reflects useful upstream skill libraries without requiring us to hand-pick every individual skill. The immediate goal is to expand skill coverage from trusted providers while keeping the trust boundary clear and testable.

## Scope

This change covers catalog ingestion only. It does not change plugin package behavior, plugin SDK typing, release packaging, or the public CDN workflow beyond the normal catalog output produced by aggregation.

Trusted sources for this pass:

- `anthropics/skills`
- `microsoft/azure-skills`
- Existing trusted GitHub skill sources already listed in `trusted-sources.json`

Sources not added in this pass:

- `vercel-labs/skills`
- `vercel-labs/agent-skills`
- `remotion-dev/skills`

Those sources appeared in the skills.sh top list, but they are not part of the current "all trusted sources" import decision.

## Current Behavior

The catalog currently produces 67 items: 4 AoA plugin items, 1 Anthropic skill, 48 gstack skills, and 14 superpowers skills.

The Anthropic adapter clones `anthropics/skills` but only scans top-level folders for `SKILL.md`. The current upstream repo stores real skills under `skills/<slug>/SKILL.md`, so the adapter misses the real Anthropic skills and only imports `template-skill`.

The generic GitHub skills adapter already supports trusted GitHub sources with a configurable `skillsPath`. It can import Microsoft Azure skills if `trusted-sources.json` adds `microsoft/azure-skills` with `skillsPath: "skills"`.

## Desired Behavior

Anthropic ingestion will import every valid `SKILL.md` under `skills/` in `anthropics/skills`. The adapter will keep Anthropic items trusted as `verified`, preserve inline skill content, and continue to skip malformed individual skills without failing the whole aggregation.

Microsoft Azure ingestion will import every valid `SKILL.md` under `skills/` in `microsoft/azure-skills`. It will not scan `.github/plugins/azure-skills/skills`, because that tree duplicates the public skill tree and would create confusing duplicate or nested imports.

Existing trusted sources will continue to work:

- `garrytan/gstack` from repo root, with its existing ignore rules
- `obra/superpowers` from `skills/`
- AoA-curated plugin/content ingestion

The generated catalog will contain all imported trusted skills, pass schema and automated checks, and produce no validation errors.

## Architecture

Use the existing source-adapter architecture. The implementation is intentionally small:

- Update the Anthropic adapter to scan `skills/` first, falling back only if needed for test fixtures or future compatibility.
- Add `microsoft/azure-skills` to `trusted-sources.json` as a `github-skills` source with `skillsPath: "skills"` and trust tier `verified`.
- Keep the generic GitHub adapter broad-import behavior for trusted sources. Do not add ranking or skills.sh-specific logic in this pass.

This keeps skills.sh as discovery input, not as a runtime dependency. The marketplace remains driven by auditable GitHub sources and pinned catalog snapshots.

## Data Flow

1. `pnpm aggregate` loads `trusted-sources.json`.
2. The Anthropic adapter clones `anthropics/skills` and normalizes all skills under `skills/`.
3. The GitHub skills adapter reads each `github-skills` trusted source, clones the configured repo/ref, scans the configured `skillsPath`, and normalizes each `SKILL.md`.
4. Automated checks validate schema, semver, source URL, license when available, and inline content size.
5. Aggregation deduplicates by canonical catalog item ID and writes `dist/catalog.json`.

## Trust And Safety

Only sources listed in `trusted-sources.json` are imported. Microsoft and Anthropic are treated as verified trusted upstreams. Vercel and Remotion are intentionally excluded until we decide they should be trusted marketplace sources.

The Azure source will use the repository license detected by the GitHub skills adapter. Microsoft Azure skills currently include an MIT license at repo root, which is allowed by the catalog validator.

Anthropic skills continue to bypass raw license validation because the existing Anthropic adapter omits `rawManifest`, matching current trusted-source behavior.

## Testing

Implementation will be test-driven.

Required tests:

- Anthropic adapter test: a fixture repo with `skills/example/SKILL.md` is imported.
- Anthropic adapter regression test: root-level folders without `SKILL.md` do not produce noisy or invalid catalog items.
- GitHub skills adapter test: a source configured with `skillsPath: "skills"` imports all valid skills under that path.
- GitHub skills adapter test: a source with `skillsPath: "skills"` does not import duplicate `SKILL.md` files outside that path.
- Aggregate or validation test: the configured trusted sources can aggregate without schema errors.

Verification commands:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm validate
```

Full `pnpm test` is not a required completion gate for this feature because unrelated plugin test/typecheck issues already exist in the repository.

## Success Criteria

- Anthropic imports real upstream skills from `skills/`, not only `template-skill`.
- Microsoft Azure skills are included from `microsoft/azure-skills` under `skills/`.
- Existing gstack and superpowers skills remain present.
- Catalog validation reports zero errors.
- Catalog builder tests pass.
- The design does not add skills.sh as a live dependency.
