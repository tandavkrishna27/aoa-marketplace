# Marketplace Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical, agent-readable marketplace documentation and standards for skills, plugins, agents, and teams.

**Architecture:** Create a dedicated `docs/marketplace/` documentation tree that mirrors the real catalog architecture and separates active standards from roadmap standards. Update the root `README.md` only as a pointer to the canonical docs, keeping detailed guidance in focused marketplace pages.

**Tech Stack:** Markdown, existing TypeScript catalog source references, PowerShell verification commands.

---

## File Structure

Create:

- `docs/marketplace/README.md`: documentation hub and current-versus-roadmap status table.
- `docs/marketplace/architecture.md`: catalog aggregation pipeline and implementation map.
- `docs/marketplace/catalog-schema.md`: plain-English catalog item schema guide.
- `docs/marketplace/trust-and-review.md`: trust tiers, warnings, failures, and PR review policy.
- `docs/marketplace/provider-metadata.md`: provider registry and logo/fallback behavior.
- `docs/marketplace/agent-workflows.md`: agent-readable runbooks for common marketplace tasks.
- `docs/marketplace/standards/skills.md`: active skill standard.
- `docs/marketplace/standards/plugins.md`: active plugin standard.
- `docs/marketplace/standards/agents.md`: roadmap agent standard.
- `docs/marketplace/standards/teams.md`: roadmap team standard.

Modify:

- `README.md`: add a short link to the new marketplace docs and replace stale plugin-only guidance with a docs pointer.

Reference during implementation:

- `catalog/src/types/catalog.ts`
- `catalog/src/aggregate.ts`
- `catalog/src/sources/aoa-curated/adapter.ts`
- `catalog/src/sources/github-skills/adapter.ts`
- `catalog/src/installer/skill-bundle.ts`
- `catalog/src/validators/automated-checks.ts`
- `catalog/src/validators/manifest-drift.ts`
- `trusted-sources.json`
- `content/providers.json`
- `plugins/aoa-plugin-discord/manifest.json`
- `plugins/aoa-plugin-slack/manifest.json`
- `plugins/aoa-plugin-telegram/manifest.json`
- `plugins/aoa-plugin-github-issues/manifest.json`

## Task 1: Marketplace Docs Hub

**Files:**

- Create: `docs/marketplace/README.md`
- Modify: `README.md`

- [ ] **Step 1: Create the docs hub**

Create `docs/marketplace/README.md` with these sections:

```markdown
# AoA Marketplace Documentation

## What This Repo Owns

## Current Standards

| Surface | Status | Entry Point |
| --- | --- | --- |
| Skills | Current | `standards/skills.md` |
| Plugins | Current | `standards/plugins.md` |
| Agents | Roadmap | `standards/agents.md` |
| Teams | Roadmap | `standards/teams.md` |

## How The Catalog Is Built

## Common Workflows

## Agent Checklist
```

The page must link to every other new marketplace doc.

- [ ] **Step 2: Update root README**

Modify `README.md` so the top section points to `docs/marketplace/README.md` as the canonical docs entrypoint.

Keep the existing development commands, but replace the detailed "Adding a new plugin" TL;DR with a short pointer to `docs/marketplace/standards/plugins.md` and `docs/marketplace/agent-workflows.md`.

- [ ] **Step 3: Review links**

Run:

```powershell
Test-Path docs/marketplace/README.md
Test-Path docs/marketplace/standards
```

Expected: both commands print `True`.

## Task 2: Architecture And Schema Docs

**Files:**

- Create: `docs/marketplace/architecture.md`
- Create: `docs/marketplace/catalog-schema.md`

- [ ] **Step 1: Write architecture page**

Create `architecture.md` with these sections:

```markdown
# Marketplace Architecture

## Pipeline

## Source Adapters

## Trust Resolution

## Provider Resolution

## Validation

## Output And CDN

## Implementation Map

## Agent Checklist
```

The pipeline must describe adapters, trust resolution, provider resolution, automated checks, dedupe, and `dist/catalog.json` output.

- [ ] **Step 2: Write schema page**

Create `catalog-schema.md` with these sections:

```markdown
# Catalog Schema

## Shared Fields

## Source

## Trust

## Provider

## Skills

## Plugins

## Agents

## Teams

## Agent Checklist
```

The agents and teams sections must say their item types exist in the schema, but their full standard remains roadmap until importer, installer, dependency, and runtime tests are added.

- [ ] **Step 3: Verify implementation references**

Run:

```powershell
rg -n "catalog/src/types/catalog.ts|catalog/src/aggregate.ts|catalog/src/sources" docs/marketplace/architecture.md docs/marketplace/catalog-schema.md
```

Expected: each command output includes the referenced implementation files.

## Task 3: Trust And Provider Docs

**Files:**

- Create: `docs/marketplace/trust-and-review.md`
- Create: `docs/marketplace/provider-metadata.md`

- [ ] **Step 1: Write trust and review page**

Create `trust-and-review.md` with these sections:

```markdown
# Trust And Review

## Trust Tiers

## Trusted Sources

## Warnings Versus Failures

## Broad Skill Tool Warnings

## PR Review Standard

## Agent Checklist
```

The page must explain that warnings can be acceptable with review, while failures reject items.

- [ ] **Step 2: Write provider metadata page**

Create `provider-metadata.md` with these sections:

```markdown
# Provider Metadata

## Registry

## Resolution Rules

## Logos

## Fallbacks

## Adding A Provider

## Agent Checklist
```

The page must explain that current logos use external URLs, usually GitHub avatars, and binary logo assets are not required in this repo yet.

- [ ] **Step 3: Verify registry references**

Run:

```powershell
rg -n "trusted-sources.json|content/providers.json|allowed-tools|warnings|failures" docs/marketplace/trust-and-review.md docs/marketplace/provider-metadata.md
```

Expected: output includes all key source files and warning/failure terminology.

## Task 4: Standards Docs

**Files:**

- Create: `docs/marketplace/standards/skills.md`
- Create: `docs/marketplace/standards/plugins.md`
- Create: `docs/marketplace/standards/agents.md`
- Create: `docs/marketplace/standards/teams.md`

- [ ] **Step 1: Write active skill standard**

Create `skills.md` with these sections:

```markdown
# Skill Standard

## Status

## Directory Shape

## SKILL.md

## Optional Bundle Files

## Frontmatter

## Bundle Metadata

## Import And Install Behavior

## Validation

## Agent Checklist
```

The status section must say skills are a current/enforced marketplace standard.

- [ ] **Step 2: Write active plugin standard**

Create `plugins.md` with these sections:

```markdown
# Plugin Standard

## Status

## Workspace Shape

## package.json

## manifest.json

## Capabilities

## Drift Checks

## Tests And Build

## Publish Path

## Agent Checklist
```

The status section must say plugins are a current/enforced marketplace standard for AoA-curated plugin packages.

- [ ] **Step 3: Write roadmap agent standard**

Create `agents.md` with these sections:

```markdown
# Agent Standard

## Status

## Current Schema Support

## Proposed Manifest Shape

## Proposed Dependencies

## Runtime Work Needed

## Before This Becomes Current

## Agent Checklist
```

The status section must say this is roadmap/proposed, not an enforced marketplace standard.

- [ ] **Step 4: Write roadmap team standard**

Create `teams.md` with these sections:

```markdown
# Team Standard

## Status

## Current Schema Support

## Proposed Composition Shape

## Proposed Dependencies

## Runtime Work Needed

## Before This Becomes Current

## Agent Checklist
```

The status section must say this is roadmap/proposed, not an enforced marketplace standard.

- [ ] **Step 5: Verify current and roadmap labels**

Run:

```powershell
rg -n "current/enforced|roadmap/proposed|not an enforced marketplace standard" docs/marketplace/standards
```

Expected: skills and plugins include `current/enforced`; agents and teams include `roadmap/proposed` and `not an enforced marketplace standard`.

## Task 5: Agent Workflows

**Files:**

- Create: `docs/marketplace/agent-workflows.md`

- [ ] **Step 1: Write workflow runbooks**

Create `agent-workflows.md` with these sections:

```markdown
# Agent Workflows

## Before Editing

## Add A Trusted GitHub Skill Source

## Add Provider Metadata

## Review Aggregation Warnings

## Add Or Update An AoA Plugin

## Add AoA-Curated Content

## Verification Commands

## PR Checklist
```

Each workflow must name the files to inspect and the commands to run.

- [ ] **Step 2: Include verification command policy**

Add this policy:

````markdown
For catalog or source changes, run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
```

For docs-only changes, run:

```powershell
rg -n "TODO|TBD|coming soon|placeholder" docs/marketplace README.md
git diff --check
```
````

- [ ] **Step 3: Verify workflow references**

Run:

```powershell
rg -n "trusted-sources.json|content/providers.json|pnpm validate|pnpm aggregate|git diff --check" docs/marketplace/agent-workflows.md
```

Expected: all terms are present.

## Task 6: Full Documentation Review

**Files:**

- Review: `README.md`
- Review: `docs/marketplace/**/*.md`

- [ ] **Step 1: Placeholder scan**

Run:

```powershell
rg -n "TODO|TBD|coming soon|placeholder" docs/marketplace README.md
```

Expected: no output.

- [ ] **Step 2: Key reference scan**

Run:

```powershell
rg -n "catalog/src/types/catalog.ts|trusted-sources.json|content/providers.json|catalog/src/aggregate.ts|catalog/src/installer/skill-bundle.ts" docs/marketplace README.md
```

Expected: output includes each key implementation file at least once.

- [ ] **Step 3: Path existence check**

Run:

```powershell
Test-Path docs/marketplace/README.md
Test-Path docs/marketplace/architecture.md
Test-Path docs/marketplace/catalog-schema.md
Test-Path docs/marketplace/trust-and-review.md
Test-Path docs/marketplace/provider-metadata.md
Test-Path docs/marketplace/agent-workflows.md
Test-Path docs/marketplace/standards/skills.md
Test-Path docs/marketplace/standards/plugins.md
Test-Path docs/marketplace/standards/agents.md
Test-Path docs/marketplace/standards/teams.md
```

Expected: every command prints `True`.

- [ ] **Step 4: Diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Decide whether code validation is needed**

If only Markdown files and `README.md` changed, do not run `pnpm validate`; explain in the PR that the change is docs-only and was verified with link/path/reference checks.

If any catalog code, JSON registry, plugin manifest, package metadata, or trusted source file changed, run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
pnpm validate
pnpm aggregate
```

## Task 7: Commit And PR

**Files:**

- Stage all created docs and the root `README.md`.

- [ ] **Step 1: Review git status**

Run:

```bash
git status --short
```

Expected: only `README.md`, `docs/marketplace/**`, and this plan/spec are modified or added. Ignore untracked `.claude/` if present.

- [ ] **Step 2: Commit**

Run:

```bash
git add README.md docs/marketplace docs/superpowers/specs/2026-05-14-marketplace-documentation-design.md docs/superpowers/plans/2026-05-14-marketplace-documentation.md
git commit -m "docs: add marketplace standards"
```

- [ ] **Step 3: Push and open PR**

Run:

```bash
git push -u origin codex/marketplace-docs-plan
gh pr create --base main --head codex/marketplace-docs-plan --title "docs: add marketplace standards" --body "Adds canonical marketplace documentation, active standards for skills/plugins, and roadmap standards for agents/teams."
```

The PR description must mention:

- docs-only change unless implementation touched code
- active standards: skills and plugins
- roadmap standards: agents and teams
- verification commands that were run
