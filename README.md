# AoA Marketplace

This public repository is the open-source source-of-truth monorepo for the AoA marketplace. It contains the catalog builder, curated skills, agents and teams, and the source of AoA plugin packages. See [marketplace documentation](docs/marketplace/README.md) for the catalog format and contribution workflow.

## Connected repositories

- [Army-of-Agents](https://github.com/tandavkrishna27/Army-of-Agents) — the main AoA application and plugin SDK.
- [aoa-marketplace](https://github.com/tandavkrishna27/aoa-marketplace) — this source monorepo.
- [aoa-marketplace-cdn](https://github.com/tandavkrishna27/aoa-marketplace-cdn) — published catalog and asset delivery. This is an output repository, not the place to edit marketplace source.
- [AoA-Skills](https://github.com/tandavkrishna27/AoA-Skills) — connected skills repository.
- [aoa-community](https://github.com/tandavkrishna27/aoa-community) — community repository.

Website: [armyofagents.org](https://armyofagents.org).

## Repository layout

- `catalog/` — adapters, validation and aggregation for the published catalog.
- `plugins/aoa-plugin-*/` — plugin source packages named under the `@armyofagents` npm scope.
- `content/{skills,agents,teams}/` — curated marketplace content.
- `trusted-sources.json` — source trust configuration.
- `.changeset/` and `.github/workflows/` — package release and catalog delivery configuration.

Edit marketplace source here. The aggregation and publishing workflows deliver catalog output to the CDN repository.

## Development

The plugin packages use a local link to the AoA plugin SDK in a sibling application checkout. Clone both repositories under the same parent directory before installing dependencies or running plugin checks:

```text
<parent>/aoa-marketplace/
<parent>/Army-of-Agents/packages/plugins/sdk/
```

For example:

```bash
git clone https://github.com/tandavkrishna27/Army-of-Agents.git Army-of-Agents
git clone https://github.com/tandavkrishna27/aoa-marketplace.git aoa-marketplace
cd aoa-marketplace
pnpm install
```

Then run the commands below. The SDK link is for development; published plugin packages should depend on a released SDK version.

```bash
pnpm install
pnpm aggregate
pnpm validate
pnpm test
pnpm typecheck
pnpm build
```

To add a plugin, see the [plugin standard](docs/marketplace/standards/plugins.md) and [workflow guide](docs/marketplace/agent-workflows.md).

## License

MIT. See [LICENSE](LICENSE). Existing plugin authorship and package-level license declarations are retained.
