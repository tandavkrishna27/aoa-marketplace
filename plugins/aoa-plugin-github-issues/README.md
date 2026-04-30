# @armyofagents/aoa-plugin-github-issues

Bidirectional GitHub Issues sync for [AoA](https://armyofagents.org).

This is the first external AoA plugin built as a standalone npm package, created to validate the plugin developer experience.

## What it does

- **Selective linking** - pick individual GitHub issues to sync with AoA issues
- **Bidirectional status sync** - close a GitHub issue, the AoA issue updates (and vice versa)
- **Comment bridging** - optionally mirror comments between systems
- **Agent tools** - AoA agents can search GitHub issues and create links during runs
- **Webhook support** - receives GitHub webhook events for real-time sync
- **Periodic polling** - catches changes missed by webhooks

## Requirements

- AoA instance with plugin runtime enabled (requires PR #821 to be merged)
- GitHub personal access token with `repo` scope (or fine-grained token with Issues read/write)

## Installation

```bash
# From the AoA CLI
pnpm aoa plugin install @armyofagents/aoa-plugin-github-issues
```

Or for development:

```bash
git clone https://github.com/tandavkrishna27/aoa-marketplace
cd @armyofagents/aoa-plugin-github-issues
npm install
npm run build
```

## Configuration

After installation, configure the plugin in AoA Settings > GitHub Issues Sync:

1. **Create a secret** - go to AoA Settings → Secrets, click "Add Secret", paste your GitHub PAT as the value, and copy the generated UUID
2. **GitHub Token** - paste the secret UUID from step 1 into the "GitHub Token" field
3. **Default Repository** - optional `owner/repo` for agent tool searches
4. **Sync Comments** - enable to mirror comments between systems
5. **Sync Direction** - bidirectional, github-to-aoa, or AoA-to-github

## GitHub Webhook Setup

For real-time sync, configure a webhook on your GitHub repository:

1. Go to your GitHub repo > Settings > Webhooks > Add webhook
2. Payload URL: `https://your-AoA-instance/api/plugins/@armyofagents/aoa-plugin-github-issues/webhooks/github-events`
3. Content type: `application/json`
4. Events: select "Issues" and "Issue comments"

## Agent Tools

Agents in AoA can use these tools during runs:

- **github-issues:search** - search GitHub issues by query
- **github-issues:link** - link a GitHub issue to the current AoA issue
- **github-issues:unlink** - remove the sync link

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

## Status

This plugin was built ahead of the plugin runtime landing on master (PR #821). It implements the full SDK contract based on the plugin spec and example plugins. Testing against a live AoA instance will happen once the plugin runtime ships.

## Migration

### v0.1.1

The `githubTokenRef` field now requires a **secret UUID** rather than a raw token string. If you configured this plugin before v0.1.1 by pasting a raw GitHub personal access token directly into the field, you must re-configure:

1. Go to AoA Settings → Secrets and add your GitHub PAT as a new secret
2. Copy the secret's UUID
3. Go to Settings → GitHub Issues Sync and replace the old token value with the secret UUID

Plugins that were already storing a secret UUID (the intended usage) are unaffected.

## License

MIT
