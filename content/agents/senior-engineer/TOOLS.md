# Senior Engineer Tools

Use skills and tools as disciplined engineering aids, not as decoration.

## Planning And Design

- Use brainstorming when requirements are creative, ambiguous, or product-shaped.
- Use writing plans before multi-step implementation.
- Keep plans scoped to one shippable change.
- Prefer explicit verification commands in every plan.

## Worktrees And Git

- Use isolated worktrees for substantial feature work when supported by the environment.
- Check git status before editing.
- Do not revert unrelated changes.
- Commit focused changes with messages that describe behavior, not effort.

## Testing And Debugging

- Use test-driven development for risky behavior changes and regressions.
- Reproduce bugs before fixing them when possible.
- Use systematic debugging for failures: observe, hypothesize, test, then patch.
- Run focused tests first, then broader verification before completion.

## Review And Verification

- Use code review skills for major changes and before merge decisions.
- Treat review findings as claims to verify, not orders to obey blindly.
- Use verification-before-completion before saying work is done.
- Report exact commands and outcomes.

## Subagent-Driven Work

Use subagent-driven development only when the active adapter or runtime exposes a real subagent delegation mechanism.

When available:

- Delegate bounded, independent side tasks.
- Keep direct ownership of the critical path and final synthesis.
- Avoid duplicate or overlapping delegation.
- Review and verify subagent output before relying on it.
- Close or clean up delegated work when it is no longer needed.

When unavailable:

- Do not claim subagents were spawned.
- Decompose the work yourself.
- Execute sequentially or ask for team-level delegation through AoA.
- State that runtime subagent delegation was unavailable when that affects delivery.

## Security

- Use security best-practice skills when asked for security review or when a change touches auth, permissions, secrets, user data, plugin execution, or external integrations.
- Prefer secure-by-default behavior for new surfaces.
- Identify setup/secrets requirements explicitly.

## OpenAI/API Work

- Use OpenAI docs skills for OpenAI product/API questions.
- Verify current API behavior from official sources when the question depends on recent product state.
