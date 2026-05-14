# Skill Bundle Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested catalog utility that materializes a complete GitHub skill bundle directory into a local destination.

**Architecture:** Add one focused installer module under `catalog/src/installer/skill-bundle.ts` with tests in `catalog/src/installer/__tests__/skill-bundle.test.ts`. The module clones a pinned repository, validates the skill bundle path, verifies `SKILL.md`, and copies the full directory without executing files.

**Tech Stack:** TypeScript, Node.js filesystem APIs, `node:child_process` Git CLI, Vitest.

---

### Task 1: Bundle Installer Tests

**Files:**
- Create: `catalog/src/installer/__tests__/skill-bundle.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests that build local Git repositories with `SKILL.md`, `scripts/`, `references/`, `assets/`, and nested skill paths. Import `installSkillBundle` from `../skill-bundle.js`.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/installer/__tests__/skill-bundle.test.ts
```

Expected: fails because `catalog/src/installer/skill-bundle.ts` does not exist.

### Task 2: Installer Implementation

**Files:**
- Create: `catalog/src/installer/skill-bundle.ts`

- [ ] **Step 1: Implement path validation**

Create `validateSkillBundlePath(path: string): void` that rejects empty, absolute, drive-prefixed, NUL-containing, empty-segment, `.`, and `..` paths.

- [ ] **Step 2: Implement installation**

Create `installSkillBundle(bundle, options)` that resolves repo URL, clones to a temp directory, checks out `bundle.commitSha`, verifies `SKILL.md`, and copies the directory.

- [ ] **Step 3: Verify focused tests pass**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/installer/__tests__/skill-bundle.test.ts
```

Expected: all installer tests pass.

### Task 3: Full Verification And PR

**Files:**
- Review all modified files.

- [ ] **Step 1: Run catalog tests**

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
```

- [ ] **Step 2: Run validation**

```bash
pnpm validate
```

- [ ] **Step 3: Run aggregate**

```bash
pnpm aggregate
```

- [ ] **Step 4: Commit and open PR**

```bash
git add catalog/src/installer docs/superpowers/specs/2026-05-14-skill-bundle-installer-design.md docs/superpowers/plans/2026-05-14-skill-bundle-installer.md
git commit -m "feat: add skill bundle installer"
git push -u origin codex/skill-bundle-installer
gh pr create --base main --head codex/skill-bundle-installer
```
