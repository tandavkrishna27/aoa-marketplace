# Provider Metadata Design

## Purpose

AoA Marketplace now imports hundreds of trusted skills from official provider repositories. The catalog needs stable provider identity so AoA can display company names and logos consistently.

The goal is to add provider metadata to catalog items without embedding logo assets or making aggregation dependent on downloading images.

## Catalog Shape

Every catalog item should be able to carry a provider object:

```json
{
  "provider": {
    "id": "openai",
    "name": "OpenAI",
    "homepageUrl": "https://openai.com",
    "logoUrl": "https://github.com/openai.png",
    "fallbackInitials": "OI"
  }
}
```

`provider.logoUrl` is optional. AoA UI must fall back to `fallbackInitials` or a generic icon if the image fails to load.

## Provider Registry

Create a curated registry at:

```text
content/providers.json
```

The registry maps known source repositories to provider metadata:

```json
{
  "schemaVersion": "1.0.0",
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "homepageUrl": "https://openai.com",
      "logoUrl": "https://github.com/openai.png",
      "fallbackInitials": "OI",
      "repos": ["openai/skills"]
    }
  ]
}
```

The first pass uses GitHub organization avatars. It does not download, normalize, or commit binary logo files.

## Resolution Rules

Provider resolution runs during aggregation after adapters normalize items.

1. If an item is a skill and has `skill.bundle.repo`, match that repo against `content/providers.json`.
2. If an item is a plugin from `aoa-curated`, attach the AoA provider.
3. If no registry entry matches a GitHub repo, create a derived fallback:
   - `id`: lowercase sanitized repo owner
   - `name`: repo owner with separators converted to words
   - `logoUrl`: `https://github.com/<owner>.png`
   - `fallbackInitials`: initials from the owner
4. If no repo can be identified, attach an unknown provider:
   - `id`: `unknown`
   - `name`: `Unknown Provider`
   - no `logoUrl`
   - `fallbackInitials`: `?`

## Included Providers

The registry should cover all current trusted imported repositories:

- AoA
- Anthropic
- Microsoft Azure
- gstack
- Superpowers
- Angular
- Google Gemini
- Stripe
- Expo
- Cloudflare
- Hugging Face
- WordPress
- OpenAI
- Figma
- Notion
- Resend
- Auth0
- Brave
- Apollo GraphQL
- CodeRabbit
- Datadog
- Firebase
- Flutter
- Netlify
- Google Workspace
- Google Labs Stitch
- Neon
- Redis

## Testing Requirements

Implementation must be test-first.

Required coverage:

- provider registry schema accepts valid provider entries
- provider registry rejects invalid logo/homepage URLs
- known repo resolves to curated provider metadata
- unknown repo resolves to GitHub-owner fallback
- AoA-curated plugin resolves to AoA provider
- catalog schema accepts provider metadata
- aggregate output has provider metadata on every item
- OpenAI, Stripe, Azure, Google Labs Stitch, and AoA sample items resolve to expected providers

Verification commands:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
```

## Success Criteria

- Every generated catalog item has provider metadata.
- Provider names and logo URLs are stable and display-ready.
- Missing or unknown providers degrade safely.
- No binary/logo asset download is required in this PR.
- Existing skill bundle metadata and installer behavior remain unchanged.
