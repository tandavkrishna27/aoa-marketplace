# AoA Marketplace Catalog (Private Monorepo)

Source-of-truth monorepo for the AoA marketplace. Holds catalog infrastructure, all AoA-curated plugin source code, and all AoA-curated content (skills, agents, teams).

**Public CDN URL:** `https://meteoritelabs.github.io/aoa-marketplace-cdn/catalog.json`

## Layout

- `catalog/` — catalog infrastructure (adapters, validation, aggregation)
- `plugins/aoa-plugin-X/` — each plugin = its own pnpm workspace package, publishes to npm as `@armyofagents/aoa-plugin-X`
- `content/{skills,agents,teams}/{slug}/` — non-plugin AoA-curated content
- `trusted-sources.json` — trust tier source list
- `.changeset/` — Changesets (per-package versioning + npm publish)
- `.github/workflows/` — CI (aggregate → CDN; publish-plugins → npm)

## Development

```bash
pnpm install                                   # install all workspace packages
pnpm aggregate                                 # build catalog.json
pnpm validate                                  # validation only
pnpm test                                      # all tests across all packages
pnpm --filter @armyofagents/aoa-plugin-X build # build a specific plugin
```

## Adding a new plugin

See the migration playbook in the AoA marketplace V1 plan (`docs/superpowers/plans/2026-04-30-marketplace-m1-catalog-infrastructure.md`, Migration playbook section) in the AoA repo.

TL;DR:
1. Create `plugins/aoa-plugin-X/` with `package.json` + `manifest.json` + `src/`
2. `pnpm install` from monorepo root
3. `pnpm changeset` to record the change
4. PR + merge → Changesets publishes to npm + aggregation picks it up

## Adding a source adapter

See `catalog/src/sources/aoa-curated/adapter.ts` for the pattern. Each adapter exports a `SourceAdapter` object.

## See also

- AoA repo: `https://github.com/MeteoriteLabs/aoa`
- Public CDN mirror: `https://github.com/MeteoriteLabs/aoa-marketplace-cdn` (auto-populated by CI from this repo)
- Community list: `https://github.com/MeteoriteLabs/aoa-community` (rebranded awesome-aoa)
