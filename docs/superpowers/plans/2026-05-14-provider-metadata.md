# Provider Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider identity and logo metadata to every catalog item.

**Architecture:** Introduce a curated `content/providers.json` registry and a focused resolver module under `catalog/src/providers/`. Aggregation loads the registry once and enriches each accepted item with provider metadata before dedupe/output.

**Tech Stack:** TypeScript, Zod, Vitest, existing catalog builder pipeline.

---

### Task 1: Provider Schema And Resolver Tests

**Files:**
- Create: `catalog/src/providers/__tests__/provider-registry.test.ts`
- Modify: `catalog/src/types/catalog.ts`

- [ ] **Step 1: Write failing tests**

Add tests for loading a fixture provider registry, resolving a known repo, deriving an unknown GitHub owner fallback, and resolving an AoA-curated plugin.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/providers/__tests__/provider-registry.test.ts src/__tests__/catalog-schema.test.ts
```

Expected: fails because provider schema/resolver does not exist.

### Task 2: Provider Registry Implementation

**Files:**
- Create: `catalog/src/providers/provider-registry.ts`
- Create: `content/providers.json`
- Modify: `catalog/src/types/catalog.ts`

- [ ] **Step 1: Implement provider schemas**

Add `ProviderRefSchema` to catalog types with `id`, `name`, optional `homepageUrl`, optional `logoUrl`, and `fallbackInitials`.

- [ ] **Step 2: Implement resolver**

Implement `loadProviderRegistry(root)` and `resolveProviderForItem(item, registry)`.

- [ ] **Step 3: Add curated provider registry**

Create `content/providers.json` covering all current trusted repos.

- [ ] **Step 4: Verify focused tests pass**

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/providers/__tests__/provider-registry.test.ts src/__tests__/catalog-schema.test.ts
```

Expected: focused tests pass.

### Task 3: Aggregate Enrichment

**Files:**
- Modify: `catalog/src/aggregate.ts`
- Modify: `catalog/src/__tests__/aggregate.test.ts`

- [ ] **Step 1: Write failing aggregate assertions**

Assert every aggregate item has provider metadata when items are present. Assert representative providers:

- `plugin:aoa-curated/aoa-plugin-discord` -> `aoa`
- `skill:github-skills/openai/skills/openai-docs` -> `openai`
- `skill:github-skills/google-labs-code/stitch-skills/remotion` -> `google-labs-stitch`

- [ ] **Step 2: Enrich accepted items**

Load providers once in `aggregate()` and attach `provider` to each accepted item before dedupe.

- [ ] **Step 3: Verify aggregate tests pass**

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/__tests__/aggregate.test.ts
```

### Task 4: Full Verification And PR

**Files:**
- Review all modified files.

- [ ] **Step 1: Run tests**

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder typecheck
```

- [ ] **Step 3: Run validate and aggregate**

```bash
pnpm validate
pnpm aggregate
```

- [ ] **Step 4: Inspect provider coverage**

Run a script that counts catalog items missing `provider` and prints provider counts.

- [ ] **Step 5: Commit and open PR**

```bash
git add catalog/src content/providers.json docs/superpowers/specs/2026-05-14-provider-metadata-design.md docs/superpowers/plans/2026-05-14-provider-metadata.md
git commit -m "feat: add provider metadata"
git push -u origin codex/provider-metadata
gh pr create --base main --head codex/provider-metadata
```
