# Crew Marketplace Reconciliation + Reviewer Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every marketplace crew agent definition actually match the running AoA product (real tool names, real personas), fold in this session's behavior changes, fix the roster, and add a critique-only Reviewer agent.

**Architecture:** Marketplace-installed companies are governed entirely by `content/agents/aoa-*/agent.json` (the codebase `ensure-*` seeding is skipped via the `templateOrigin` gate at `AoA-crew-hardening/server/src/index.ts:701-732`). So each agent's `agent.json.runtimeConfig.aoa` (instruction + toolAllowlist + triggers + role) must mirror the codebase source of truth. Per-wakeup action directives stay in the AoA codebase (runtime, keyed by role); the marketplace carries persona + allowlist + skills + triggers.

**Tech Stack:** JSON agent manifests + Markdown personas in `aoa-marketplace`; the catalog builder is TypeScript (`catalog/`, validated with `pnpm validate` / `vitest`). The codebase Reviewer support is TypeScript in `AoA-crew-hardening/server`.

**Two repos / paths:**
- `MP = C:\Users\TK\OneDrive\Desktop\Claude Data\Paperclip-AoA\aoa-marketplace` (branch `feat/crew-codebase-reconciliation`)
- `CB = C:\Users\TK\OneDrive\Desktop\Claude Data\Paperclip-AoA\AoA-crew-hardening` (branch `feat/thread-chat-experience`) — SOURCE OF TRUTH, read-only here.

**Spec:** `MP/docs/superpowers/specs/2026-06-03-crew-marketplace-reconciliation-design.md`.

> Shell note: the working dir resets between commands — always `cd` to an absolute path inside the same command.

---

## File structure (what changes)

```
MP/content/agents/aoa-adjutant/{agent.json, AGENTS.md, manifest.json}     ← reconcile (Task 1)
MP/content/agents/aoa-scout/{agent.json, AGENTS.md, manifest.json}        ← reconcile (Task 2)
MP/content/agents/aoa-engineer/{agent.json, AGENTS.md, manifest.json}     ← reconcile (Task 3)
MP/content/agents/aoa-planner/{agent.json, AGENTS.md, manifest.json}      ← reconcile (Task 4)
MP/content/agents/aoa-navigator/{agent.json, AGENTS.md, manifest.json}    ← reconcile (Task 5)
MP/content/agents/aoa-memory-keeper/{agent.json, AGENTS.md, manifest.json}← reconcile (Task 6)
MP/content/agents/aoa-dispatcher/                                         ← DELETE (Task 7)
MP/content/agents/aoa-chronicler/{agent.json, AGENTS.md, manifest.json}   ← CREATE (Task 8)
MP/content/agents/aoa-reviewer/{agent.json, AGENTS.md, manifest.json}     ← CREATE (Task 9)
MP/content/teams/default-crew/...                                         ← update roster (Task 10)
CB/server/src/services/internal-agent/aoa-agents/autonomy.ts             ← add reviewer role (Task 0)
CB/server/src/services/internal-agent/aoa-agents/aoa-trigger-prompt.ts   ← add reviewer directive (Task 0)
CB/server/src/__tests__/aoa-trigger-prompt.test.ts                        ← reviewer directive test (Task 0)
```

---

## Shared reconciliation procedure (Tasks 1–6)

For each existing crew agent `aoa-<role>`:

1. **Read the codebase source of truth** for that role:
   - Adjutant → `CB/.../ensure-adjutant.ts` (`ADJUTANT_TOOL_ALLOWLIST` + `ADJUTANT_INSTRUCTION`).
   - Scout → `CB/.../ensure-scout.ts`. Engineer → `CB/.../ensure-engineer.ts`.
   - Planner / Navigator / Memory Keeper → `CB/.../ensure-command-staff.ts` (`roleToolAllowlist()` case + `ROLE_INSTRUCTIONS`).
2. **Rewrite `agent.json`** `runtimeConfig.aoa`:
   - `toolAllowlist` = the EXACT array from the codebase allowlist. Every entry must be a real tool name (verify against `CB/server/src/services/internal-agent/tool-registry.ts` + `tools/`). Remove every legacy/non-existent name.
   - `instruction` = the codebase persona text (the `ensure-*` instruction string).
   - `role` stays `member`; `triggers[].config.role` = the real role key (`adjutant`/`scout`/`engineer`/`planner`/`navigator`/`memory_keeper`); `triggers[].kind` = the codebase trigger kind(s) (Adjutant `sweep`; Scout `mention`; Engineer `mention` **and** `phase-advance` — dual-triggered; Planner `phase-advance`; Navigator `mention`; Memory Keeper `sweep` — migrated from the dead `outbox` trigger).
   - `kind` = `aoa`. Keep `schemaVersion`, `id`, `instructions: { type: "file", path: "AGENTS.md" }`, `heartbeat: { enabled: false, intervalSec: 0 }`, `skillKeys` (unchanged).
3. **Rewrite `AGENTS.md`** so the persona matches the new instruction. Remove any reference to the retired **Dispatcher** (say "the founder approves the scope card" or "Dispatcher (retired) → the system creates tasks on approval" as appropriate to the role).
4. **Keep `manifest.json`** `requires` (skills) as-is; only fix `description` if it references the wrong behavior/tools.
5. **Validate this agent:** `cd "MP/catalog" && pnpm validate` (expect: no errors for this agent).
6. **Commit** (one agent per commit).

Canonical `agent.json` shape (reference — aoa-planner, fields to preserve):
```json
{
  "schemaVersion": "agent.v1",
  "id": "aoa-<role>",
  "name": "<Name>",
  "description": "<one line>",
  "instructions": { "type": "file", "path": "AGENTS.md" },
  "aoa": {
    "adapterType": "process",
    "runtimeConfig": { "aoa": { "role": "member", "instruction": "<persona>", "toolAllowlist": ["..."] }, "heartbeat": { "enabled": false, "intervalSec": 0 } },
    "kind": "aoa",
    "skillKeys": ["..."],
    "triggers": [ { "kind": "<kind>", "enabled": true, "config": { "role": "<role>" } } ]
  }
}
```

---

## Task 0: Codebase — register the `reviewer` role + directive (repo CB)

**Files:**
- Modify: `CB/server/src/services/internal-agent/aoa-agents/autonomy.ts`
- Modify: `CB/server/src/services/internal-agent/aoa-agents/aoa-trigger-prompt.ts`
- Modify: `CB/server/src/__tests__/aoa-trigger-prompt.test.ts`

- [ ] **Step 1: Read the current role registry.** Read `autonomy.ts` (`CrewRole` union + `ROLE_MIN_AUTONOMY`). Confirm `reviewer` is absent.

- [ ] **Step 2: Write the failing test.** In `aoa-trigger-prompt.test.ts`, add (inside the existing `describe` for role directives):
```ts
it("reviewer → critique then post_entry, no mutation", () => {
  const out = buildTriggerPrompt({
    instruction: BASE_INSTRUCTION,
    payload: { companyId: "co", source: "sweep.adjutant" },
    agentName: "Reviewer",
    agentRoleKey: "reviewer",
  });
  expect(out).toMatch(/critique/i);
  expect(out).toContain("post_entry");
  expect(out).toMatch(/do NOT.*(approve|create tasks|mutate)|advise/i);
});
```

- [ ] **Step 3: Run it to confirm it fails.** `cd "CB/server" && pnpm exec vitest run src/__tests__/aoa-trigger-prompt.test.ts`. Expected: FAIL (reviewer directive falls back to GENERIC_DIRECTIVE, no "critique").

- [ ] **Step 4: Add the role.** In `autonomy.ts`: add `| "reviewer"` to the `CrewRole` union, and `reviewer: 1,` to `ROLE_MIN_AUTONOMY`.

- [ ] **Step 5: Add the directive.** In `aoa-trigger-prompt.ts` `ROLE_ACTION_DIRECTIVE`, add:
```ts
  reviewer:       "Critique the artifact, plan, or perspective under discussion in this thread: name its strengths, the gaps and risks, and concrete fixes. Then call `post_entry` exactly once with your review, parentEntryId set to the inviting entry. You ADVISE only — do NOT approve, create tasks, change task status, or mutate any artifact; the founder is the final approver.",
```

- [ ] **Step 6: Run the test (pass) + the adjutant suite.** `cd "CB/server" && pnpm exec vitest run src/__tests__/aoa-trigger-prompt.test.ts src/__tests__/adjutant-respond-branch.test.ts`. Expected: PASS.

- [ ] **Step 7: Commit (CB).**
```bash
cd "CB" && git add server/src/services/internal-agent/aoa-agents/autonomy.ts server/src/services/internal-agent/aoa-agents/aoa-trigger-prompt.ts server/src/__tests__/aoa-trigger-prompt.test.ts && git commit -m "feat(crew): register reviewer role + critique directive (marketplace Reviewer support)"
```

---

## Task 1: Reconcile aoa-adjutant (repo MP)

**Files:** Modify `MP/content/agents/aoa-adjutant/{agent.json, AGENTS.md, manifest.json}`

- [ ] **Step 1:** Read `CB/.../ensure-adjutant.ts`. The real allowlist is `ADJUTANT_TOOL_ALLOWLIST`: `query_threads, query_extracted_items, advance_phase, notify_owner, post_entry, thread.listEntries, thread.setIntent, thread.updateSummary, thread.createLink, search_discussions, get_thread_summary, find_similar_threads, extract_memory_candidates, agent.dispatch, delegate_to_subagent, use_skill, propose_crew_work`. The real persona is `ADJUTANT_INSTRUCTION` (the convene + no-auto-scope text).
- [ ] **Step 2:** Apply the Shared reconciliation procedure: set `agent.json` `toolAllowlist` to that array, `instruction` to `ADJUTANT_INSTRUCTION`, `triggers[0]` = `{ kind: "sweep", config: { role: "adjutant" } }`. Rewrite `AGENTS.md` to the convene persona (Adjutant convenes the crew in-thread, does not auto-scope, points to the Approve card; no Dispatcher references).
- [ ] **Step 3:** `cd "MP/catalog" && pnpm validate` → no errors.
- [ ] **Step 4:** Commit: `cd "MP" && git add content/agents/aoa-adjutant && git commit -m "fix(crew): reconcile aoa-adjutant agent.json/AGENTS.md to codebase (convene, real tools)"`

## Task 2: Reconcile aoa-scout (repo MP)
- [ ] Read `CB/.../ensure-scout.ts` for the exact `SCOUT` allowlist + instruction. Apply the Shared procedure. `triggers[0]` = `{ kind: "mention", config: { role: "scout" } }`. Validate, commit `content/agents/aoa-scout`.

## Task 3: Reconcile aoa-engineer (repo MP)
- [ ] Read `CB/.../ensure-engineer.ts` for the exact allowlist + instruction. Apply the Shared procedure. `triggers` = BOTH `{ kind: "mention", config: { role: "engineer" } }` AND `{ kind: "phase-advance", config: { role: "engineer" } }` — Engineer is dual-triggered in the codebase. Validate, commit `content/agents/aoa-engineer`.

## Task 4: Reconcile aoa-planner (repo MP)
- [ ] Read `CB/.../ensure-command-staff.ts` `roleToolAllowlist("planner")` (MUST include `post_entry` — the session fix) + `ROLE_INSTRUCTIONS.planner`. Apply the Shared procedure. `triggers[0]` = `{ kind: "phase-advance", config: { role: "planner" } }`. Validate, commit `content/agents/aoa-planner`.

## Task 5: Reconcile aoa-navigator (repo MP)
- [ ] Read `CB/.../ensure-command-staff.ts` `roleToolAllowlist("navigator")` + `ROLE_INSTRUCTIONS.navigator`. Apply the Shared procedure. `triggers[0]` = `{ kind: "mention", config: { role: "navigator" } }`. Validate, commit `content/agents/aoa-navigator`.

## Task 6: Reconcile aoa-memory-keeper (repo MP)
- [ ] Read `CB/.../ensure-command-staff.ts` `roleToolAllowlist("memory_keeper")` + `ROLE_INSTRUCTIONS.memory_keeper`. Apply the Shared procedure. `triggers[0]` = `{ kind: "sweep", config: { role: "memory_keeper" } }` (the codebase migrated MK from the dead `outbox` trigger to `sweep`). Validate, commit `content/agents/aoa-memory-keeper`.

---

## Task 7: Delete the retired Dispatcher (repo MP)
- [ ] **Step 1:** `cd "MP" && git rm -r content/agents/aoa-dispatcher`
- [ ] **Step 2:** Grep for stragglers: `cd "MP" && grep -rn "aoa-dispatcher\|dispatcher" content/teams catalog/src 2>/dev/null` — note any reference (the team is fixed in Task 10).
- [ ] **Step 3:** `cd "MP/catalog" && pnpm validate` → no dangling reference to aoa-dispatcher.
- [ ] **Step 4:** Commit: `cd "MP" && git commit -m "fix(crew): remove retired aoa-dispatcher from marketplace"`

## Task 8: Add aoa-chronicler (repo MP)
**Files:** Create `MP/content/agents/aoa-chronicler/{agent.json, AGENTS.md, manifest.json}`
- [ ] **Step 1:** Read `CB/.../ensure-chronicler.ts` for the exact allowlist (summary-only: `get_thread_summary`, `thread.updateSummary`, `thread.listEntries`) + instruction.
- [ ] **Step 2:** Create `agent.json` (role `chronicler`, `triggers[0]` = `{ kind: "sweep", config: { role: "chronicler" } }`, `toolAllowlist` = the three summary tools, `instruction` = the Chronicler persona ("maintain the thread summary card; never post_entry"), `kind: "aoa"`, `instructions: { type: "file", path: "AGENTS.md" }`, `skillKeys: []`). Create `AGENTS.md` (the persona). Create `manifest.json` (id `agent:aoa-curated/aoa-chronicler`, name "Chronicler", category `workflows`, tags `["official"]`, sourceUrl the repo, `runtime.entry: "agent.json"`, `requires: []`, capabilities describing thread summarization).
- [ ] **Step 3:** `cd "MP/catalog" && pnpm validate` → passes.
- [ ] **Step 4:** Commit `content/agents/aoa-chronicler`.

## Task 9: Add aoa-reviewer (repo MP)
**Files:** Create `MP/content/agents/aoa-reviewer/{agent.json, AGENTS.md, manifest.json}`
- [ ] **Step 1:** Create `agent.json`:
  - `runtimeConfig.aoa.role`: `member`; `instruction`: the critique persona (advise-only); `toolAllowlist`: `["get_task", "query_artifacts", "search_discussions", "get_thread_summary", "thread.listEntries", "post_entry", "use_skill"]` (verify each exists in the CB tool registry; NO write/mutate tools).
  - `triggers[0]`: `{ kind: "mention", config: { role: "reviewer" } }`. `kind: "aoa"`. `instructions: { type: "file", path: "AGENTS.md" }`.
  - `skillKeys`: the same IDs the Engineer manifest uses for review + code-review (read them from `MP/content/agents/aoa-engineer/manifest.json` `requires` — e.g. `skill:github-skills/coderabbitai/skills/code-review`).
- [ ] **Step 2:** Create `AGENTS.md` (the critique persona: strengths / gaps / risks / concrete fixes; advise only; founder is the approver).
- [ ] **Step 3:** Create `manifest.json` (id `agent:aoa-curated/aoa-reviewer`, name "Reviewer", description "Critiques crew artifacts/plans in-thread — strengths, gaps, risks, fixes — advise only.", category `workflows`, tags `["official"]`, sourceUrl the repo, `runtime.entry: "agent.json"`, `requires` = review + code-review skill refs, capabilities describing in-thread critique).
- [ ] **Step 4:** `cd "MP/catalog" && pnpm validate` → passes; every `requires` skill resolves.
- [ ] **Step 5:** Commit `content/agents/aoa-reviewer`.

## Task 10: Update the default-crew team (repo MP)
**Files:** Modify `MP/content/teams/default-crew/*`
- [ ] **Step 1:** Read the team manifest. Remove the `aoa-dispatcher` member; add `aoa-chronicler` and `aoa-reviewer` members (match the existing member entry shape).
- [ ] **Step 2:** `cd "MP/catalog" && pnpm validate` → team resolves all members.
- [ ] **Step 3:** Commit: `cd "MP" && git commit -m "fix(crew): default-crew team — drop dispatcher, add chronicler + reviewer"`

---

## Task 11: Full verification (repo MP)
- [ ] **Step 1: Validate + build the catalog.** `cd "MP/catalog" && pnpm validate && pnpm aggregate`. Expected: catalog.json builds, no schema errors, no dangling skill `requires`.
- [ ] **Step 2: Catalog tests + typecheck.** `cd "MP/catalog" && pnpm test && pnpm typecheck`. Expected: green.
- [ ] **Step 3: Every tool name is real.** For each reconciled/new `agent.json`, extract `toolAllowlist` and confirm each name exists in the CB tool registry. One-shot check:
```bash
cd "MP" && for f in content/agents/aoa-*/agent.json; do python -c "import json,sys; print('\n'.join(((json.load(open('$f')).get('aoa') or {}).get('runtimeConfig') or {}).get('aoa',{}).get('toolAllowlist',[])))"; done | sort -u > /tmp/mp-tools.txt
# Then, for each name, grep CB/server/src/services/internal-agent for a registered tool of that name. Any name not found = a bug to fix.
```
- [ ] **Step 4: Roster check.** `cd "MP" && ls content/agents/ | grep aoa-` shows: adjutant, scout, engineer, planner, navigator, memory-keeper, chronicler, reviewer (NO dispatcher, NO commander).
- [ ] **Step 5: Commit** any fixes from Steps 1–3, then the branch is ready for PR.

---

## Self-review (author)

- **Spec coverage:** per-agent reconciliation (Tasks 1–6) ✓; roster drop Dispatcher (7) ✓; add Chronicler (8) ✓; add Reviewer codebase (0) + marketplace (9) ✓; default-crew team (10) ✓; verification catalog build + tool-name check (11) ✓; Commander excluded ✓; directives stay in CB ✓.
- **Placeholders:** allowlists/personas are "read from the exact codebase source" by design (the spec forbids hardcoding stale lists); the Reviewer + Chronicler exact allowlists ARE specified; the catalog commands ARE exact. No TBDs.
- **Consistency:** role keys (adjutant/scout/engineer/planner/navigator/memory_keeper/chronicler/reviewer), trigger kinds, and `kind: "aoa"` are consistent across tasks and match the codebase.

## Execution handoff

Plan saved. Recommended: subagent-driven-development — a fresh subagent per task (each agent reconciliation is independent), spec-then-quality review between tasks, with Task 11 as the final gate. Task 0 (codebase Reviewer support) runs in the CB repo; Tasks 1–11 run in MP.
