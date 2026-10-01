# @armyofagents/aoa-plugin-github-issues

Bidirectional GitHub Issues sync for [AoA](https://github.com/tandavkrishna27/Army-of-Agents).

## What it does

- **Selective linking** - pick individual GitHub issues to sync with AoA issues
- **Bidirectional status sync** - close a GitHub issue, the AoA issue updates (and vice versa)
- **Comment bridging** - optionally mirror comments between systems
- **Agent tools** - AoA agents can search GitHub issues and create links during runs
- **Webhook support** - receives GitHub webhook events for real-time sync
- **Periodic polling** - catches changes missed by webhooks

## Requirements

- AoA host with plugin runtime support and an available build of this package
- GitHub personal access token with `repo` scope (or fine-grained token with Issues read/write)

## Installation

The package name in `package.json` is `@armyofagents/aoa-plugin-github-issues`. It is not currently listed in the public npm registry. Build this package from the [AoA Marketplace monorepo](https://github.com/tandavkrishna27/aoa-marketplace) after installing dependencies and making the AoA plugin SDK available:

```bash
pnpm --filter @armyofagents/aoa-plugin-github-issues build
```

## Configuration

After installation, configure the plugin's instance settings in AoA with:

1. **Create a secret** - go to AoA Settings → Secrets, click "Add Secret", paste your GitHub PAT as the value, and copy the generated UUID
2. **GitHub Token** - paste the secret UUID from step 1 into the "GitHub Token" field
3. **Default Repository** - optional `owner/repo` for agent tool searches
4. **Sync Comments** - enable to mirror comments between systems
5. **Sync Direction** - bidirectional, github-to-aoa, or aoa-to-github

## GitHub Webhook Setup

For real-time sync, configure a webhook on your GitHub repository:

1. Go to your GitHub repo > Settings > Webhooks > Add webhook
2. Payload URL: use the AoA host's endpoint for plugin ID `aoa.plugin-github-issues` and webhook key `github-events`; obtain the full URL from the host
3. Content type: `application/json`
4. Events: select "Issues" and "Issue comments"

## Agent Tools

Agents in AoA can use these tools during runs:

- **search** - search GitHub issues by query
- **link** - link a GitHub issue to the current AoA issue
- **unlink** - remove the sync link

## Plugin Architecture

```
src/
  manifest.ts    # Plugin manifest (capabilities, tools, webhooks, UI slots)
  worker.ts      # Plugin worker (event handlers, sync logic, tool registration)
  constants.ts   # Shared constants
  github.ts      # GitHub REST API client
  sync.ts        # Sync state management and bidirectional logic
  index.ts       # Package exports
```

Built with the AoA Plugin SDK (`@armyofagents/plugin-sdk`).

## Migration

### Secret references

The `githubTokenRef` field requires a **secret UUID** rather than a raw token string. If an existing configuration contains a raw GitHub personal access token, reconfigure it:

1. Go to AoA Settings → Secrets and add your GitHub PAT as a new secret
2. Copy the secret's UUID
3. Go to Settings → GitHub Issues Sync and replace the old token value with the secret UUID

Plugins that were already storing a secret UUID (the intended usage) are unaffected.

## Authorship and license

The plugin manifest retains Matt Van Horn as author. MIT; see the [root license](../../LICENSE).
