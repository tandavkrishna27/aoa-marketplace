# GitHub Issue Triager Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plugin-backed GitHub Issue Triager marketplace agent that exercises skills, plugin dependencies, setup secrets, plugin configuration, and bundled instructions.

**Architecture:** The marketplace agent lives in `content/agents/github-issue-triager/`. `manifest.json` declares the canonical install dependencies and catalog capabilities. `agent.json` declares runtime aliases and AoA install/setup hints. The instruction bundle uses `AGENTS.md`, `SOUL.md`, `TOOLS.md`, and `HEARTBEAT.md`.

**Tech Stack:** AoA marketplace content schema, JSON agent runtime contract, markdown instruction bundles, pnpm validation and aggregation.

---

### Task 1: Add GitHub Issue Triager Content

**Files:**
- Create: `content/agents/github-issue-triager/manifest.json`
- Create: `content/agents/github-issue-triager/agent.json`
- Create: `content/agents/github-issue-triager/AGENTS.md`
- Create: `content/agents/github-issue-triager/SOUL.md`
- Create: `content/agents/github-issue-triager/TOOLS.md`
- Create: `content/agents/github-issue-triager/HEARTBEAT.md`

- [x] **Step 1: Declare catalog metadata**

Create `manifest.json` with `runtime.entry: "agent.json"`, five skill dependencies, and the GitHub Issues plugin dependency with `versionRange: "^1.0.0"`.

- [x] **Step 2: Declare runtime aliases and AoA setup hints**

Create `agent.json` with bundle instructions, dependency aliases, `adapterCompatibility`, paused default install status, required `GITHUB_TOKEN`, and required GitHub Issues plugin config.

- [x] **Step 3: Add instruction bundle**

Create `AGENTS.md`, `SOUL.md`, `TOOLS.md`, and `HEARTBEAT.md` with triage behavior, setup awareness, external-write caution, security escalation, and done criteria.

### Task 2: Verify Marketplace Contract

**Files:**
- Read: `dist/catalog.json`

- [x] **Step 1: Run focused agent tests**

Run:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test -- src/sources/aoa-curated/__tests__/agent-content.test.ts src/sources/aoa-curated/__tests__/adapter.test.ts src/types/__tests__/agent.test.ts
```

Expected: all focused tests pass.

- [x] **Step 2: Run catalog validation**

Run:

```bash
pnpm validate
```

Expected: aggregation validation reports 0 errors and includes the new AoA-curated agent.

- [x] **Step 3: Run aggregate**

Run:

```bash
pnpm aggregate
```

Expected: `dist/catalog.json` is written and contains `agent:aoa-curated/github-issue-triager`.

- [x] **Step 4: Check whitespace**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.
