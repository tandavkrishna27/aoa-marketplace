# AoA Marketplace Catalog 

Source-of-truth monorepo for the AoA marketplace. Holds catalog infrastructure, all AoA-curated plugin source code, and all AoA-curated content (skills, agents, teams).

Canonical marketplace documentation starts at [`docs/marketplace/README.md`](docs/marketplace/README.md).

**Public CDN URL:** `https://meteoritelabs.github.io/aoa-marketplace-cdn/catalog.json`

## Layout

- `catalog/` - catalog infrastructure (adapters, validation, aggregation)
- `plugins/aoa-plugin-X/` - each plugin = its own pnpm workspace package, publishes to npm as `@armyofagents/aoa-plugin-X`
- `content/{skills,agents,teams}/{slug}/` - non-plugin AoA-curated content
- `trusted-sources.json` - trust tier source list
- `.changeset/` - Changesets (per-package versioning + npm publish)
- `.github/workflows/` - CI (aggregate -> CDN; publish-plugins -> npm)

## Development

```bash
pnpm install                                   # install all workspace packages
pnpm aggregate                                 # build catalog.json
pnpm validate                                  # validation only
pnpm test                                      # all tests across all packages
pnpm --filter @armyofagents/aoa-plugin-X build # build a specific plugin
```

## Adding a new plugin

Use the plugin standard at [`docs/marketplace/standards/plugins.md`](docs/marketplace/standards/plugins.md), then follow the runbook in [`docs/marketplace/agent-workflows.md`](docs/marketplace/agent-workflows.md).

## Adding a source adapter

See `catalog/src/sources/aoa-curated/adapter.ts` for the pattern. Each adapter exports a `SourceAdapter` object.

## See also

- AoA repo: `https://github.com/MeteoriteLabs/aoa`
- Public CDN mirror: `https://github.com/MeteoriteLabs/aoa-marketplace-cdn` (auto-populated by CI from this repo)
- Community list: `https://github.com/MeteoriteLabs/aoa-community` (rebranded awesome-paperclip)
