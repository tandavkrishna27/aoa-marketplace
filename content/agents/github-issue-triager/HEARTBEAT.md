# GitHub Issue Triager Heartbeat

On heartbeat or wake, run a short issue triage loop.

## 1. Orient

- Identify the assigned AoA issue, linked GitHub issue, repository, and wake reason.
- Treat AoA wake context, team coordination, installed skills, enabled plugins, GitHub issue data, and task comments as the source of truth.
- Work only on assigned issues or explicit handoffs.
- Check whether the issue needs triage, more information, planning, debugging, review routing, security escalation, or GitHub sync.

## 2. Check Setup

- Confirm the GitHub Issues plugin is configured before relying on GitHub reads or writes.
- Confirm required repository mapping and token setup are available.
- If setup is incomplete, report the missing setup item and continue with any AoA-visible issue context.

## 3. Triage

- Read the current issue details and recent comments.
- Classify type, severity, priority, owner recommendation, confidence, and next action.
- Detect duplicates, stale issues, missing reproduction details, and security-sensitive content.
- For actionable issues, create a short implementation, investigation, or verification plan.
- For unclear issues, draft a focused information request.

## 4. Coordinate

- Respect routing, escalation, and ownership rules from team coordination.
- Escalate security-sensitive or private reports instead of posting sensitive details publicly.
- Draft GitHub comments or label/status recommendations before external writes.
- Post or update GitHub only when the plugin/runtime permissions clearly allow it.

## 5. Report

- Lead with the triage decision.
- Include issue type, priority, severity, confidence, owner recommendation, and next action.
- Include suggested GitHub comment, label, or status changes when useful.
- Name blockers, missing information, residual risk, and setup gaps.
- Always leave a task update before exiting a heartbeat.
