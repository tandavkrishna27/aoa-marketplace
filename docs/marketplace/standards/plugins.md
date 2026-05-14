# Plugin Standard

## Status

Plugins are a current/enforced marketplace standard for AoA-curated plugin packages under `plugins/aoa-plugin-*`.

`catalog/src/sources/aoa-curated/adapter.ts` scans local plugin workspace packages, reads each `package.json` and `manifest.json`, runs capability drift checks, and emits catalog items with `type: "plugin"` and npm install metadata.

## Workspace Shape

A current AoA-curated plugin package uses this shape:

```text
plugins/aoa-plugin-example/
  package.json
  manifest.json
  README.md
  src/
    index.ts
    manifest.ts
  tests/
  tsconfig.json
  dist/
```

The catalog adapter requires `package.json` and `manifest.json`. Source, tests, and build output are required for an implementation-quality plugin even though catalog scanning only reads the package metadata, marketplace manifest, and compiled manifest drift target.

## package.json

`package.json` provides npm install metadata and repository provenance.

Expected fields include:

- `name`, usually `@armyofagents/aoa-plugin-*`.
- `version`, matching the marketplace manifest version.
- `description`.
- `type: "module"`.
- `main` and `types` pointing into `dist/`.
- `files` including `dist`, `manifest.json`, and `README.md`.
- `scripts` for `build`, `test`, and `typecheck`.
- `repository.url` and `repository.directory`.
- `license`.
- `peerDependencies` for `@armyofagents/plugin-sdk`.

The adapter uses `package.json` to build `source.url`, `source.locator`, `npm.packageName`, and release tarball metadata.

## manifest.json

`manifest.json` is the marketplace-facing plugin manifest read by `catalog/src/sources/aoa-curated/adapter.ts`.

Current fields include:

- `id`
- `displayName`
- `description`
- `version`
- `license`
- `capabilities`
- `capabilityDescriptions`
- `marketplace.category`
- `marketplace.tags`
- `marketplace.featured`

Existing plugin manifests such as `plugins/aoa-plugin-discord/manifest.json`, `plugins/aoa-plugin-slack/manifest.json`, `plugins/aoa-plugin-telegram/manifest.json`, and `plugins/aoa-plugin-github-issues/manifest.json` are the best local examples.

## Capabilities

Capabilities are permission-like strings that describe what the plugin can do. Each listed capability needs a human-readable description in `capabilityDescriptions`.

`catalog/src/validators/automated-checks.ts` treats capability descriptions as enforced review data:

- Missing plugin capabilities create a warning.
- Missing or too-short capability descriptions create failures.

Use concrete descriptions that name the AoA data, runtime primitive, external API, webhook, UI surface, job, or event stream involved.

## Drift Checks

`catalog/src/validators/manifest-drift.ts` compares compiled `dist/manifest.js` capabilities against `manifest.json`.

Drift behavior:

- If `dist/manifest.js` is missing, drift validation is skipped.
- Capabilities present in compiled source but missing from `manifest.json` are errors and the plugin is skipped by the adapter.
- Capabilities present in `manifest.json` but absent from compiled source are warnings.

Before relying on drift checks, build the plugin so `dist/manifest.js` exists.

## Tests And Build

Each plugin should keep package-local build, typecheck, and test scripts working:

```powershell
pnpm --filter @armyofagents/aoa-plugin-discord build
pnpm --filter @armyofagents/aoa-plugin-discord typecheck
pnpm --filter @armyofagents/aoa-plugin-discord test
```

For marketplace-level validation after plugin metadata changes, run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
git diff --check
```

## Publish Path

The catalog item includes npm metadata:

- `npm.packageName` comes from `package.json`.
- `npm.version` comes from `manifest.json`.
- `npm.tarballUrl` points to the repo release tarball path for that version.

The current tarball URL pattern is assembled in `catalog/src/sources/aoa-curated/adapter.ts` from the GitHub release base, `manifest.version`, and normalized package name.

## Agent Checklist

When adding or updating an AoA-curated plugin:

1. Inspect the target `plugins/aoa-plugin-*/package.json`.
2. Inspect the target `plugins/aoa-plugin-*/manifest.json`.
3. Inspect the target `plugins/aoa-plugin-*/src/manifest.ts`.
4. Inspect `catalog/src/sources/aoa-curated/adapter.ts`.
5. Inspect `catalog/src/validators/manifest-drift.ts`.
6. Confirm every capability has a useful `capabilityDescriptions` entry.
7. Confirm `manifest.json` version and `package.json` version are intentionally aligned.
8. Run the package `build`, `typecheck`, and `test` scripts.
9. Run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
10. Run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
11. Run `pnpm validate`.
12. Run `pnpm aggregate`.
13. Run `git diff --check`.

For docs-only edits to this page, run:

```powershell
rg -n "current/enforced|roadmap/proposed|not an enforced marketplace standard" docs/marketplace/standards
git diff --check
```
