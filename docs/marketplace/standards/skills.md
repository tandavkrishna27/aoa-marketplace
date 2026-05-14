# Skill Standard

## Status

Skills are a current/enforced marketplace standard for trusted skill bundles imported by `catalog/src/sources/github-skills/adapter.ts` and `catalog/src/sources/anthropic-skills/adapter.ts`.

The active bundle paths are trusted GitHub skill directories and the trusted Anthropic skills adapter. These adapters find each `SKILL.md`, record `skill.bundle`, and pin the bundle to the upstream commit SHA. The installer in `catalog/src/installer/skill-bundle.ts` installs that whole directory, so optional files and directories such as `scripts/`, `references/`, `assets/`, examples, and helper modules are preserved.

AoA-curated local skills under `content/skills/*` are not yet the fully active skill bundle path. `catalog/src/sources/aoa-curated/adapter.ts` can scan local skill manifests and emit a `resourceUrl`, but current automated checks require a skill with `resourceUrl` to include `skill.bundle`. Until that path emits bundle metadata and passes installer coverage, treat trusted bundles from `github-skills` and `anthropic-skills` as the enforced skill standard.

## Directory Shape

A current installable skill is one directory in a trusted GitHub repository:

```text
some-skill/
  SKILL.md
  scripts/
  references/
  assets/
```

Only `SKILL.md` is required. Other files are optional and are copied with the bundle when installed.

The `github-skills` and `anthropic-skills` source configs control where the importers look:

- `trusted-sources.json` lists trusted sources.
- The source config names the repository, ref, `skillsPath`, ignore patterns, and optional default category.
- `catalog/src/sources/github-skills/adapter.ts` walks the configured `skillsPath` for `SKILL.md` files.
- `catalog/src/sources/anthropic-skills/adapter.ts` emits trusted Anthropic skill bundles with installable `skill.bundle` metadata.

## SKILL.md

`SKILL.md` is the required entry file for each skill directory. The adapter parses its frontmatter and uses the Markdown body as the source skill instructions.

The catalog item name, description, version, category, tags, runtime requirements, and frontmatter metadata are derived from `SKILL.md` plus source-level defaults and overrides.

## Optional Bundle Files

Optional files and directories are supported for active skill bundles from trusted source adapters. The installer clones the pinned repository, checks out `skill.bundle.commitSha`, validates `skill.bundle.path`, verifies `SKILL.md` exists, and copies the entire source directory to the destination.

Installer behavior in `catalog/src/installer/skill-bundle.ts`:

- Requires `bundle.type` to be `github-directory`.
- Rejects unsafe absolute, empty, dot-segment, drive-letter, or NUL-containing bundle paths.
- Requires the destination to resolve to an absolute path.
- Refuses filesystem-root destinations.
- Skips symbolic links while copying.
- Preserves normal files and nested directories.

## Frontmatter

Frontmatter is parsed by the GitHub skills adapter and represented in `skill.frontmatter` according to `catalog/src/types/catalog.ts`.

Supported preserved fields include:

- `name`
- `description`
- `license`
- `compatibility`
- `metadata`
- `allowedTools`
- `userInvocable`
- `disableModelInvocation`
- `raw`

The active skill adapters also use skill frontmatter for normalized catalog fields such as version, category, tags, and runtime requirements where available. Unknown raw frontmatter is preserved in `skill.frontmatter.raw` for review and future compatibility.

## Bundle Metadata

Current installable skill items include:

```json
{
  "skill": {
    "bundle": {
      "type": "github-directory",
      "repo": "owner/repo",
      "commitSha": "abcdef123",
      "path": "path/to/skill",
      "treeUrl": "https://github.com/owner/repo/tree/abcdef123/path/to/skill"
    }
  }
}
```

`catalog/src/types/catalog.ts` enforces this shape through `SkillBundleSchema` and `SkillMetadataSchema`.

## Import And Install Behavior

Import behavior:

- `catalog/src/sources/github-skills/adapter.ts` and `catalog/src/sources/anthropic-skills/adapter.ts` read their trusted source configuration.
- They clone each configured GitHub repository and ref.
- They walk the configured skills root for `SKILL.md`.
- They emit catalog items with `type: "skill"`, `resourceUrl`, `skill.bundle`, and `skill.frontmatter`.
- They pin `resourceUrl` and `skill.bundle` to the upstream source commit.

Install behavior:

- `catalog/src/installer/skill-bundle.ts` installs only `github-directory` bundles.
- The installer copies the full skill directory, not just `SKILL.md`.
- Optional bundle files remain part of the installed skill.

## Validation

Automated checks in `catalog/src/validators/automated-checks.ts` enforce the catalog schema, semver, source URL validity, license allow-list behavior when raw manifest data is present, inline content size, and skill-specific bundle rules.

Skill-specific validation:

- A skill item with `resourceUrl` must declare `skill.bundle`.
- `skill.bundle.path` must be a safe relative path.
- Broad `allowedTools` values such as shell, bash, cmd, powershell, or `*` create warnings.

Warnings are review prompts. Failures reject the item from the generated catalog.

## Agent Checklist

When adding or reviewing an active trusted skill source:

1. Inspect `trusted-sources.json`.
2. Inspect `catalog/src/sources/github-skills/adapter.ts`.
3. Inspect `catalog/src/sources/anthropic-skills/adapter.ts`.
4. Inspect `catalog/src/installer/skill-bundle.ts`.
5. Inspect `catalog/src/validators/automated-checks.ts`.
6. Confirm each skill directory has `SKILL.md`.
7. Confirm optional files are meant to ship with the skill bundle.
8. Run `pnpm --filter @armyofagents/aoa-marketplace-builder test`.
9. Run `pnpm --filter @armyofagents/aoa-marketplace-builder typecheck`.
10. Run `pnpm validate`.
11. Run `pnpm aggregate`.
12. Run `git diff --check`.

For docs-only edits to this page, run:

```powershell
rg -n "anthropic-skills|github-skills|skill.bundle|content/skills" docs/marketplace/standards/skills.md
git diff --check
```
