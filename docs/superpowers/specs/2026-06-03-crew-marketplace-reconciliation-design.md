# Crew Marketplace Reconciliation + Reviewer Agent — Design

**Goal:** Make the AoA marketplace crew agent definitions (`content/agents/aoa-*/`) actually match the running product, fold in this session's behavior changes, and add a new Reviewer agent. Today the marketplace crew is a non-functional early draft.

**Repos:**
- `aoa-marketplace` (this repo, branch `feat/crew-codebase-reconciliation` off main) — the agent definitions.
- `AoA-crew-hardening` (`feat/thread-chat-experience`) — the codebase + the source of truth.

## Why this matters

A company that installs the crew from the marketplace gets the marketplace `agent.json` definitions verbatim, and the codebase `ensure-*` seeding is **skipped** (`server/src/index.ts:701-732`, the `templateOrigin` "marketplace governs" gate). The current marketplace crew references tool names that **do not exist** in the codebase tool registry (`advance_thread_phase`, `query_thread_state`, `create_thread_summary`, `create_research_note`, `query_discussions`), lacks the real tools (`post_entry`, `agent.dispatch`, `propose_crew_work`, the Spec B crew-task tools), still ships the retired Dispatcher, and is missing Chronicler. So marketplace-installed crews are broken. (Legacy companies are unaffected — they're codebase-seeded.)

## Architecture (confirmed; do NOT change)

- **Marketplace governs installed crew.** `agent.json.runtimeConfig.aoa` (instruction + toolAllowlist + skillKeys + triggers + role + kind) IS the seeded agent for marketplace-installed companies.
- **Commander is NOT a marketplace agent.** `ensure-commander.ts` defines it in the codebase; only its `skillKeys` come from installed marketplace skills. Out of scope — do not add `aoa-commander`.
- **Per-wakeup directives stay in the codebase.** `aoa-trigger-prompt.ts ROLE_ACTION_DIRECTIVE` is runtime, keyed by role, and applies to marketplace-installed agents by role. The convene / advise-first / reviewer DIRECTIVES live in the AoA codebase, NOT the marketplace. The marketplace carries the PERSONA (instruction), tool allowlist, skill assignments, triggers, and role.

## Source of truth (read these for exact values; do NOT hardcode from this spec)

Per agent, the real definition lives in the codebase. The implementer reconciles each marketplace `agent.json` to MATCH these exactly:
- Allowlist + persona: `ensure-adjutant.ts`, `ensure-scout.ts`, `ensure-engineer.ts`, `ensure-chronicler.ts`, and `ensure-command-staff.ts` (`roleToolAllowlist()` + `ROLE_INSTRUCTIONS` for Planner / Navigator / Memory Keeper).
- Role + min-autonomy: `autonomy.ts` (`ROLE_MIN_AUTONOMY`).
- Trigger kind per role: the `ensure-*` trigger config (sweep → adjutant, mention → scout/engineer, phase-advance → planner, outbox → memory_keeper, sweep.chronicler → chronicler).
- Tool-name validity: every tool name must exist in the codebase tool registry (`server/src/services/internal-agent/tool-registry.ts` + `tools/`).

## The reconciliation (per agent)

For each of **Adjutant, Scout, Engineer, Planner, Navigator, Memory Keeper**, and the NEW **Chronicler**:
1. `agent.json` → `runtimeConfig.aoa`: set `toolAllowlist` = the codebase allowlist (real tool names only), `instruction` = the codebase persona, `role` + `triggers[].config.role` correct, `kind: "aoa"`. Remove every non-existent tool name.
2. `AGENTS.md` → rewrite the persona to match (no retired-Dispatcher references; reflect convene/advise behavior at the persona level where relevant).
3. `manifest.json` → keep the existing `requires` skills (they are good), fix description/capabilities to match the real role.

This session's specific deltas that must land:
- **Adjutant** persona: convenes the crew + does not auto-scope (from `ensure-adjutant.ts`).
- **Planner** allowlist: includes `post_entry` (the silent-Planner fix).
- Engineer/Planner advise-first is a runtime directive — already committed in the codebase; no marketplace change needed beyond the allowlist.

## Roster changes

- DELETE `content/agents/aoa-dispatcher/` (Dispatcher retired in the codebase).
- ADD `content/agents/aoa-chronicler/` — summary-only: allowlist `get_thread_summary` + `thread.updateSummary` + `thread.listEntries`; trigger `sweep` (`sweep.chronicler`); role `chronicler`; min-autonomy 0; never `post_entry`.
- ADD `content/agents/aoa-reviewer/` (below).
- Update `content/teams/default-crew` to the new roster (drop dispatcher; add chronicler + reviewer).
- Do NOT add Commander.

## Reviewer agent (new) — both repos

**Codebase (`AoA-crew-hardening`):**
- `autonomy.ts`: add `reviewer` to `CrewRole` and `ROLE_MIN_AUTONOMY` (= 1, like Scout).
- `aoa-trigger-prompt.ts`: add a `reviewer` directive — "critique the artifact / plan / perspective in the thread (strengths, gaps, risks, concrete fixes), then `post_entry` exactly once. You advise; you do NOT approve, create tasks, or mutate anything — the founder is the final approver."
- Register `reviewer` wherever roles are validated/resolved (tool-registry role map, resolve-crew-role, etc.) so the directive resolves.

**Marketplace (`content/agents/aoa-reviewer/`):**
- `agent.json`: role `reviewer`, kind `aoa`, trigger `mention`, `instruction` = the critique persona, `toolAllowlist` = READ tools (`get_task`, `query_artifacts`, `search_discussions`, `get_thread_summary`, `thread.listEntries`) **+ `post_entry`** + `use_skill`. NO write/mutate tools (preserves founder-as-gatekeeper).
- `AGENTS.md`: the critique persona.
- `manifest.json`: catalog metadata + `requires` skills `review` + `code-review` (real gstack/superpowers bundles) + capabilities.

## Verification

- Run the `aoa-marketplace` catalog build + validation so every changed/new `agent.json` + `manifest.json` passes the schema (`agent.v1`, the catalog `CatalogItemSchema`), and no `requires` skill reference dangles.
- Assert every tool name in every reconciled allowlist exists in the AoA codebase tool registry (the exact bug being fixed) — a checklist or a small cross-repo check.
- Marketplace catalog tests stay green.

## Non-goals

- Commander as a marketplace agent (codebase-governed; skills-only).
- Renaming/aliasing codebase tools to the draft marketplace names (we reconcile marketplace → codebase, never the reverse).
- The per-wakeup directives themselves (already in the codebase).
- Live-installing the reconciled crew into a running AoA instance (separate follow-up QA).
