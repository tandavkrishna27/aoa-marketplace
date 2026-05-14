# Marketplace Architecture

## Pipeline

The marketplace catalog is built by `catalog/src/aggregate.ts`. It loads source adapters, asks each adapter to fetch and normalize raw data, resolves trust, resolves provider metadata, runs automated checks, dedupes by catalog item id, and writes `dist/catalog.json`.

Current adapters include AoA-curated local content from `catalog/src/sources/aoa-curated/adapter.ts`, imported GitHub skill directories from `catalog/src/sources/github-skills/adapter.ts`, and the Anthropic skills adapter registered in `catalog/src/aggregate.ts`. Each adapter returns normalized catalog items that match the schema in `catalog/src/types/catalog.ts`.

The high-level flow is:

1. Load `trusted-sources.json` and `content/providers.json`.
2. Compute the current marketplace repository commit SHA for AoA-curated source references.
3. Run each source adapter in deterministic order.
4. Normalize raw source data into catalog items.
5. Resolve the trust tier for each item.
6. Resolve provider metadata for each item.
7. Run automated validation checks.
8. Keep valid items and record warnings.
9. Dedupe by canonical item id, preferring the higher trust tier.
10. Sort by id and write `dist/catalog.json`.

## Source Adapters

Source adapters are the boundary between source-specific data and the shared catalog schema. The adapter contract is defined in `catalog/src/types/source-adapter.ts` and implemented by each source under `catalog/src/sources`.

`catalog/src/sources/aoa-curated/adapter.ts` scans this repository for:

- `plugins/*/package.json` and `plugins/*/manifest.json` plugin packages.
- `content/skills/*/manifest.json` skill content.
- `content/agents/*/manifest.json` agent content.
- `content/teams/*/manifest.json` team content.

For plugins, the AoA-curated adapter emits npm install metadata and checks source manifest drift before accepting the item. For snapshot content, it emits a `resourceUrl` pinned to the current marketplace repo commit for the canonical content file.

`catalog/src/sources/github-skills/adapter.ts` reads trusted GitHub skill source configuration from `trusted-sources.json`, clones each configured repository and ref, finds `SKILL.md` files, parses frontmatter, and emits skill items with `resourceUrl` and `skill.bundle` metadata pinned to the upstream clone commit.

## Trust Resolution

Trust is resolved in `catalog/src/aggregate.ts` with the trust resolver before validation. Adapter defaults are not the final authority; imported sources are checked against `trusted-sources.json`.

The catalog schema supports these trust tiers:

- `verified`
- `community`
- `unverified`

When duplicate ids appear, dedupe prefers the item with the higher trust tier. Equal trust keeps the first item encountered, which is deterministic because adapter order is fixed in `catalog/src/aggregate.ts`.

## Provider Resolution

Provider metadata is resolved after trust and before validation. `catalog/src/providers/provider-registry.ts` loads `content/providers.json` and maps repository owners or repositories to provider objects.

Resolution uses explicit registry entries first. If a GitHub repository is known but no registry entry exists, the provider resolver creates a fallback provider from the GitHub owner, including a GitHub avatar URL and fallback initials. AoA-curated items can resolve to the AoA provider entry when the marketplace repository is registered.

## Validation

Automated checks run in `catalog/src/validators/automated-checks.ts`. The checks re-parse the normalized item with `CatalogItemSchema` from `catalog/src/types/catalog.ts`, verify semver, validate plugin capability descriptions, check allowed licenses when raw manifest data is available, validate source URLs, warn on suspicious description patterns, enforce inline content size limits, and apply skill-specific bundle checks.

Failures reject an item from the generated output. Warnings are recorded for review but do not block aggregation. Examples include plugins with no capabilities, missing license fields where raw manifest data is supplied, and skills that request broad allowed-tools permissions.

## Output And CDN

The aggregate step writes a catalog file shaped by `CatalogFileSchema` in `catalog/src/types/catalog.ts`. The default output path is `dist/catalog.json`.

`dist/catalog.json` contains:

- `schemaVersion`
- `generatedAt`
- `itemCount`
- `items`

The aggregation code notes that CI publishes this generated file to the public CDN mirror. The CDN root is treated as the marketplace root, so consumers fetch the catalog without a nested marketplace subpath.

## Implementation Map

Start with these files when changing or reviewing marketplace behavior:

| Area | File |
| --- | --- |
| Catalog item and file schema | `catalog/src/types/catalog.ts` |
| Aggregation pipeline | `catalog/src/aggregate.ts` |
| Source adapter interface | `catalog/src/types/source-adapter.ts` |
| AoA-curated plugins and content | `catalog/src/sources/aoa-curated/adapter.ts` |
| Imported GitHub skills | `catalog/src/sources/github-skills/adapter.ts` |
| Imported Anthropic skills | `catalog/src/sources/anthropic-skills/adapter.ts` |
| Automated validation | `catalog/src/validators/automated-checks.ts` |
| Provider registry and fallback rules | `catalog/src/providers/provider-registry.ts` |
| Trusted source configuration | `trusted-sources.json` |
| Provider metadata | `content/providers.json` |

## Agent Checklist

- Inspect `catalog/src/types/catalog.ts` before documenting or changing catalog fields.
- Inspect `catalog/src/aggregate.ts` before changing pipeline order, dedupe, output, or validation behavior.
- Inspect `catalog/src/sources` before changing source-specific import rules.
- Inspect `catalog/src/validators/automated-checks.ts` before changing warning or failure language.
- Inspect `catalog/src/providers/provider-registry.ts` before changing provider metadata behavior.
- For Task 2 documentation verification, run `rg -n "catalog/src/types/catalog.ts|catalog/src/aggregate.ts|catalog/src/sources" docs/marketplace/architecture.md docs/marketplace/catalog-schema.md`.
- Run `git diff --check` before handing off.
