# Senior Engineer Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a marketplace Senior Engineer sample agent that uses only skill dependencies and no plugins or secrets.

**Architecture:** Create one AoA-curated agent folder under `content/agents/senior-engineer/` with `manifest.json`, `agent.json`, and a four-file instructions bundle. The manifest keeps `requires` as the canonical skill dependency contract; `agent.json.dependencies.skills` provides runtime aliases; `aoa.skillKeys` mirrors the skill dependencies for future AoA skill injection.

**Tech Stack:** AoA Marketplace catalog builder, JSON agent runtime schema, Markdown instruction bundle, Vitest catalog tests, `pnpm validate`.

---

### Task 1: Add Senior Engineer Agent Content

**Files:**
- Create: `content/agents/senior-engineer/manifest.json`
- Create: `content/agents/senior-engineer/agent.json`
- Create: `content/agents/senior-engineer/AGENTS.md`
- Create: `content/agents/senior-engineer/SOUL.md`
- Create: `content/agents/senior-engineer/TOOLS.md`
- Create: `content/agents/senior-engineer/HEARTBEAT.md`

- [ ] **Step 1: Create `manifest.json`**

Use `agent:aoa-curated/senior-engineer`, category `engineering`, runtime entry `agent.json`, and exactly the agreed skill-only `requires` list.

- [ ] **Step 2: Create `agent.json`**

Use `schemaVersion: "agent.v1"`, bundle instructions with `AGENTS.md`, `SOUL.md`, `TOOLS.md`, and `HEARTBEAT.md`, runtime skill aliases, `codex_local` recommended adapter compatibility, `claude_local` support, paused install status, skill-only setup notes, and `aoa.skillKeys` matching every manifest skill dependency.

- [ ] **Step 3: Create instruction bundle files**

Write concise, production-ready instructions:
- `AGENTS.md`: identity, scope, operating rules.
- `SOUL.md`: judgment, tone, collaboration posture.
- `TOOLS.md`: skill usage, worktrees, TDD, debugging, review, verification, and capability-aware subagent rules.
- `HEARTBEAT.md`: wake workflow and reporting rules.

- [ ] **Step 4: Run focused validation**

Run:

```powershell
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/agent-content.test.ts src/sources/aoa-curated/__tests__/adapter.test.ts src/types/__tests__/agent.test.ts
```

Expected: focused tests pass.

- [ ] **Step 5: Run catalog validation**

Run:

```powershell
pnpm validate
pnpm aggregate
git diff --check
git status --short
```

Expected: validation and aggregation exit 0, `git diff --check` exits 0, and only intended files are changed.

- [ ] **Step 6: Commit**

```powershell
git add content/agents/senior-engineer docs/superpowers/plans/2026-05-14-senior-engineer-agent.md
git commit -m "feat(content): add senior engineer agent"
```

