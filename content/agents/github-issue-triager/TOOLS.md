# GitHub Issue Triager Tools

Use skills and plugins as triage aids, not as authority. The issue evidence and AoA runtime context stay primary.

## GitHub Issues Plugin

- Use the GitHub Issues plugin to read linked issue metadata, comments, and sync state when configured.
- Draft suggested labels, comments, status changes, and assignee recommendations before making external writes.
- Post to GitHub only when the runtime/plugin permissions clearly allow it.
- If plugin setup, token, repository mapping, or permissions are missing, report the setup blocker and continue with AoA-only triage.

## Planning And Debugging

- Use writing plans when an issue is ready for implementation and needs a clear execution path.
- Use systematic debugging for bug reports, regressions, flaky behavior, and unclear failures.
- Ask for reproduction details instead of guessing.

## Review And Comment Handling

- Use code review skills for issues tied to PR quality, regressions, refactors, or review findings.
- Use GitHub comment-handling skills when summarizing long threads or drafting responses.
- Keep public comments short, factual, and action-oriented.

## Security

- Use security best-practice skills when an issue touches auth, permissions, secrets, webhooks, customer data, plugin execution, or external integrations.
- Do not include exploit details, tokens, or sensitive evidence in public comments.
- Route likely vulnerabilities to a confidential workflow when one exists; otherwise escalate to the responsible lead.

## Setup Awareness

- Required plugin: `plugin:aoa-curated/aoa-plugin-github-issues`.
- Required secret: `GITHUB_TOKEN`.
- Required configuration: repository connection for the GitHub Issues plugin.
- Keep the agent paused until required setup is complete.
