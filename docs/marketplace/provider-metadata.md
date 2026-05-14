# Provider Metadata

## Registry

Provider metadata lives in `content/providers.json`. The provider registry implementation is `catalog/src/providers/provider-registry.ts`, and aggregation calls it from `catalog/src/aggregate.ts` after trust resolution and before automated checks.

Each provider entry includes:

| Field | Meaning |
| --- | --- |
| `id` | Stable provider id using lowercase letters, numbers, and hyphens. |
| `name` | Display name for the provider. |
| `homepageUrl` | Optional provider homepage URL. |
| `logoUrl` | Optional external logo URL. |
| `fallbackInitials` | Initials used when no logo is available or a client cannot render it. |
| `repos` | GitHub repositories owned by this provider mapping. |

The registry schema requires `schemaVersion: "1.0.0"` and at least one repo per provider entry.

## Resolution Rules

Provider resolution happens in `catalog/src/providers/provider-registry.ts`.

The resolver checks:

1. Use `item.skill.bundle.repo` when a skill bundle repo is present.
2. Otherwise derive a repo from `item.source.url` when it is a GitHub URL.
3. If a repo is resolved and appears in `content/providers.json`, use the explicit provider entry.
4. If a repo is resolved but is not in the registry, create a fallback provider from the GitHub owner and stop there.
5. Only when no repo can be resolved, if `item.source.adapter` is `aoa-curated` and the AoA marketplace repo is registered, use the AoA provider.
6. If no repo or AoA provider fallback applies, return `Unknown Provider` with `fallbackInitials: "?"`.

Keep `content/providers.json` in sync with new entries in `trusted-sources.json` when a source should display a stable provider name, homepage, or logo instead of a generated fallback.

## Logos

Current logos use external URLs, usually GitHub avatars such as `https://github.com/openai.png` or `https://github.com/MeteoriteLabs.png`.

Binary logo assets are not required in this repo yet. Do not add image files only to satisfy provider metadata unless the marketplace implementation changes to require local assets.

Logo review expectations:

- Use an HTTPS URL.
- Prefer official GitHub organization or owner avatars for GitHub-sourced providers.
- Keep `fallbackInitials` meaningful even when `logoUrl` is present.
- Avoid adding unofficial image hosts for verified providers.

## Fallbacks

Fallback behavior keeps catalog output usable even when `content/providers.json` does not have an explicit entry.

When a GitHub repo is known but unmapped, the resolver:

- Sanitizes the GitHub owner into a provider id.
- Title-cases the owner for the provider name.
- Builds `logoUrl` as `https://github.com/<owner>.png`.
- Derives fallback initials from the owner name.

When no repo can be resolved, the provider becomes:

```json
{
  "id": "unknown",
  "name": "Unknown Provider",
  "fallbackInitials": "?"
}
```

Fallbacks are acceptable for exploratory imports, but explicit provider entries are preferred for trusted sources, featured items, and sources where display quality matters.

## Adding A Provider

When adding provider metadata:

1. Inspect `trusted-sources.json` for the source repo, owner, adapter, and intended trust tier.
2. Add or update the matching entry in `content/providers.json`.
3. Include every repo that should map to the same provider in `repos`.
4. Use an external `logoUrl`, usually a GitHub avatar URL.
5. Set concise `fallbackInitials`.
6. Inspect `catalog/src/providers/provider-registry.ts` if the desired behavior is not covered by the current resolution rules.
7. Run the relevant verification commands.

If the provider entry is tied to a new trusted source, review warnings and failures from aggregation as part of the same PR. Provider metadata changes affect display, but they do not make an unsafe source safe.

## Agent Checklist

- Inspect `content/providers.json` before adding or changing provider metadata.
- Inspect `catalog/src/providers/provider-registry.ts` before changing resolution rules, fallbacks, logo behavior, or field requirements.
- Inspect `trusted-sources.json` when provider metadata corresponds to an imported source.
- Inspect `catalog/src/aggregate.ts` to confirm provider resolution still runs before automated checks.
- For provider-only docs verification, run `rg -n "trusted-sources.json|content/providers.json|allowed-tools|warnings|failures" docs/marketplace/trust-and-review.md docs/marketplace/provider-metadata.md`.
- Run `git diff --check` before handing off.
