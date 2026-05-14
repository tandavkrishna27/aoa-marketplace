# Trust And Review

## Trust Tiers

The catalog schema supports three trust tiers:

| Tier | Meaning |
| --- | --- |
| `verified` | The source is trusted by AoA maintainers or has explicit review metadata. |
| `community` | The source is known enough to list, but should receive closer review before promotion or featured placement. |
| `unverified` | The source is unknown to the trusted source registry or has not been reviewed. |

Trust affects catalog review and duplicate resolution. `catalog/src/aggregate.ts` dedupes items by id and prefers the item with the higher trust tier. Equal tiers keep the first item found in adapter order.

## Trusted Sources

`trusted-sources.json` controls source trust for imported catalog items. The trust resolver in `catalog/src/validators/trust-resolver.ts` loads that file and resolves each item's trust tier during aggregation.

Resolution rules:

- If an item already has explicit reviewer metadata, keep its existing trust tier.
- Otherwise, find a `trusted-sources.json` entry whose `adapter` matches `item.source.adapter`.
- If a source entry is found, inherit its configured tier.
- If no source entry is found, resolve the item as `unverified`.

For configured GitHub skill sources, `trusted-sources.json` also carries adapter config such as `repo`, `ref`, `skillsPath`, `ignore`, and `defaultCategory`. Review those fields as part of source trust, because a trusted source entry controls what the importer is allowed to scan.

## Warnings Versus Failures

Automated checks live in `catalog/src/validators/automated-checks.ts` and return both `warnings` and `failures`.

Failures reject an item. In `catalog/src/aggregate.ts`, an item with failures is logged as rejected, skipped, and not added to the generated catalog output. Examples include invalid schema, invalid semver, invalid source URL, unsafe skill bundle paths, unsupported licenses when raw manifest data is supplied, and skill items that declare `resourceUrl` without `skill.bundle`.

Warnings can be acceptable with review. They are recorded by aggregation and should be considered PR review prompts, not automatic rejection reasons. Examples include plugin entries with no capabilities, missing license fields where raw manifest data is available, suspicious description patterns, and broad skill `allowed-tools` permissions.

Do not silence warnings by changing documentation alone. Either fix the source, document why the warning is acceptable in the PR, or escalate it to a code or content owner.

## Broad Skill Tool Warnings

For skill items, `catalog/src/validators/automated-checks.ts` inspects `skill.frontmatter.allowedTools`. It warns when the field asks for broad execution permissions such as `*`, `shell`, `bash`, `cmd`, or `powershell`.

These broad `allowed-tools` warnings matter because they can expand what an agent is allowed to invoke when the skill is active. A broadly scoped skill may still be legitimate, especially for operational or development workflows, but it needs human review of:

- The upstream repository and commit provenance.
- The `SKILL.md` instructions and any referenced scripts.
- The reason the broad tool access is needed.
- Whether narrower tool names would satisfy the workflow.
- Whether the source trust tier in `trusted-sources.json` is appropriate.

Treat broad tool warnings as review gates. They do not block aggregation by themselves, but they should not be ignored.

## PR Review Standard

Marketplace PR review should check both the source trust model and the automated check output.

For trust changes:

- Review `trusted-sources.json` and confirm the source owner, repo, ref, `skillsPath`, ignores, category, and trust tier.
- Prefer pinned or stable upstream refs when available.
- Confirm the source is appropriate for `verified`; otherwise use `community` or leave the item `unverified`.

For validation output:

- Fail the PR if new failures are expected to reject required marketplace items.
- Review every warning and decide whether it should be fixed before merge.
- Document any accepted warnings in the PR body.
- Check `catalog/src/aggregate.ts` behavior before changing language about reject, warning, or output semantics.

For provider display:

- If a new trusted source comes from a new repo owner, check whether `content/providers.json` should also be updated.
- Review `catalog/src/providers/provider-registry.ts` before changing provider fallback expectations.

## Agent Checklist

- Inspect `trusted-sources.json` before changing source trust.
- Inspect `catalog/src/validators/trust-resolver.ts` before documenting or changing trust tier resolution.
- Inspect `catalog/src/validators/automated-checks.ts` before documenting warnings or failures.
- Inspect `catalog/src/aggregate.ts` before documenting reject, warning, dedupe, or output behavior.
- Inspect `content/providers.json` and `catalog/src/providers/provider-registry.ts` when a trusted source also needs provider metadata.
- For Task 3 documentation verification, run `rg -n "trusted-sources.json|content/providers.json|allowed-tools|warnings|failures" docs/marketplace/trust-and-review.md docs/marketplace/provider-metadata.md`.
- Run `git diff --check` before handing off.
