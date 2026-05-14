# AoA Marketplace Documentation

This is the canonical entrypoint for marketplace documentation in this repo. It links the active standards, roadmap standards, architecture notes, and agent runbooks that keep catalog work consistent.

## What This Repo Owns

This repo owns the AoA marketplace source of truth: catalog infrastructure, AoA-curated plugin packages, AoA-curated content, trusted source configuration, provider metadata, validation, aggregation, and the generated catalog that is published to the public CDN mirror.

Start with these pages when changing marketplace behavior:

- [Marketplace architecture](architecture.md)
- [Catalog schema](catalog-schema.md)
- [Trust and review](trust-and-review.md)
- [Provider metadata](provider-metadata.md)
- [Agent workflows](agent-workflows.md)

## Current Standards

| Surface | Status | Entry Point |
| --- | --- | --- |
| Skills | Current | [standards/skills.md](standards/skills.md) |
| Plugins | Current | [standards/plugins.md](standards/plugins.md) |
| Agents | Current catalog standard | [standards/agents.md](standards/agents.md) |
| Teams | Roadmap | [standards/teams.md](standards/teams.md) |

Skills, plugins, and agents are current marketplace catalog surfaces. The marketplace agent standard is enforced once validated by the catalog builder. AoA install and runtime support remain a separate consumer milestone, so do not claim AoA can install or run agents yet. Teams remain roadmap work until importer, installer, dependency, and runtime behavior are finalized.

## How The Catalog Is Built

The catalog builder reads source adapters, normalizes skills, plugins, agents, and teams into catalog items, resolves trust and provider metadata, validates entries, deduplicates items, and writes the generated catalog output consumed by the CDN mirror.

Use [architecture.md](architecture.md) for the pipeline map and [catalog-schema.md](catalog-schema.md) for the item fields.

## Common Workflows

Use [agent-workflows.md](agent-workflows.md) for step-by-step runbooks before editing marketplace sources. It covers adding trusted skill sources, adding provider metadata, reviewing aggregation warnings, updating AoA plugins, adding curated content, and choosing verification commands.

For standards work, use the specific surface page:

- [Skill standard](standards/skills.md)
- [Plugin standard](standards/plugins.md)
- [Agent standard](standards/agents.md)
- [Team standard](standards/teams.md)

## Agent Checklist

- Read this page first, then open the linked page for the surface you are editing.
- Keep current standards separate from roadmap standards in wording and reviews.
- Use [agent-workflows.md](agent-workflows.md) for exact files to inspect and commands to run.
- For plugin changes, follow [standards/plugins.md](standards/plugins.md) before editing package metadata or manifests.
- For docs-only changes, verify the touched paths and run `git diff --check`.
