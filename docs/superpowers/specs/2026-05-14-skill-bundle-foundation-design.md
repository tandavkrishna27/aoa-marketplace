# Skill Bundle Foundation Design

## Purpose

AoA Marketplace must represent skills as full installable directories, not only as `SKILL.md` preview records. This is required before importing many more providers because real-world skills often include scripts, references, assets, examples, licenses, and other supporting files beside `SKILL.md`.

The immediate goal is to make the currently imported trusted skills installable as complete skill packages while keeping the catalog useful for browsing and search.

## Confidence And Compatibility

This design is not tied to one product. Claude Code, GitHub Copilot, OpenAI/Codex, and the Agent Skills ecosystem describe the same core shape: a skill is a directory containing a required `SKILL.md` file and optional supporting resources.

The universal invariant is:

```text
skill-name/
├── SKILL.md
├── scripts/
├── references/
├── assets/
├── examples/
├── LICENSE or LICENSE.txt
└── any additional files/directories
```

Each product chooses a different parent install root, but the installed unit remains the skill directory.

## Product Install Roots

AoA should store one canonical skill package and install it into the product-specific root requested by the user or runtime:

| Product | Project Root | Global Root |
|---|---|---|
| Antigravity | `.agent/skills/` | `~/.gemini/antigravity/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |
| GitHub Copilot | `.github/skills/` or `.agents/skills/` | `~/.copilot/skills/` or `~/.agents/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Windsurf | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |

These roots are install targets, not separate catalog formats.

## Current Problem

The current catalog records enough data to browse skills:

- normalized `name`
- normalized `description`
- category/tags/trust/source
- `resourceUrl` pointing to raw `SKILL.md`
- for Anthropic, inline `SKILL.md` content

It does not preserve the full skill directory as an installable package.

This matters because many currently imported skills have sibling files:

- `anthropics/skills`: 17 skills, 16 with extra files/directories
- `microsoft/azure-skills`: 32 skills, 29 with extra files/directories
- `garrytan/gstack`: 51 skills, 47 with extra files/directories
- `obra/superpowers`: 14 skills, 8 with extra files/directories

So the trusted-skills import work gives AoA discovery coverage, but installation would be incomplete without bundle metadata.

## Desired Catalog Model

Every skill item will keep `resourceUrl` for quick preview of `SKILL.md`, and gain a `bundle` object for complete installation:

```json
{
  "resourceUrl": "https://raw.githubusercontent.com/microsoft/azure-skills/<sha>/skills/azure-ai/SKILL.md",
  "bundle": {
    "type": "github-directory",
    "repo": "microsoft/azure-skills",
    "commitSha": "<upstream-source-sha>",
    "path": "skills/azure-ai",
    "treeUrl": "https://github.com/microsoft/azure-skills/tree/<sha>/skills/azure-ai"
  }
}
```

`resourceUrl` is for display and quick parsing. `bundle` is for installation.

## Frontmatter Preservation

The catalog will continue normalizing common fields into top-level catalog fields, but will also preserve skill-standard frontmatter:

- `name`
- `description`
- `license`
- `compatibility`
- `metadata`
- `allowed-tools`
- `user-invocable`
- `disable-model-invocation`

The normalized model will expose this as:

```json
{
  "skill": {
    "frontmatter": {
      "name": "azure-ai",
      "description": "...",
      "license": "MIT",
      "compatibility": "...",
      "metadata": {},
      "allowedTools": "shell",
      "userInvocable": true,
      "disableModelInvocation": false,
      "raw": {}
    }
  }
}
```

`raw` stores recognized and unrecognized frontmatter keys after safe parsing. AoA must not execute or trust any frontmatter field directly.

## Safety Rules

The catalog builder will not execute skill scripts. It only scans files and records install metadata.

Validation will add bundle-oriented checks:

- skill item must have `bundle` when it has `resourceUrl`
- `bundle.path` must point to the directory containing `SKILL.md`
- `bundle.path` must be relative and must not contain `..`
- `bundle.treeUrl` and `resourceUrl` must use the same upstream commit SHA
- `allowed-tools` is recorded but never auto-approved
- broad tool permissions such as `*`, `shell`, `bash`, or equivalent produce warnings, not automatic failure
- optional bundle inventory may warn on very large file counts or large total byte size
- symlinks that escape the skill directory are invalid if bundle inventory is implemented

## Adapter Behavior

### GitHub Skills Adapter

For each discovered `SKILL.md`:

1. Treat the directory containing `SKILL.md` as the skill bundle root.
2. Preserve the full relative directory path under `skillsPath`.
3. Build IDs from the full path to avoid nested collisions.
4. Emit `resourceUrl` pointing to `SKILL.md`.
5. Emit `bundle` pointing to the complete directory.
6. Parse and preserve standard frontmatter fields.

### Anthropic Skills Adapter

For each `skills/<slug>/SKILL.md`:

1. Treat `skills/<slug>` as the skill bundle root.
2. Continue emitting inline content for preview compatibility.
3. Add `resourceUrl` and `bundle` with the upstream Anthropic commit SHA.
4. Parse and preserve standard frontmatter fields.

The Anthropic adapter currently does not keep the upstream source SHA. This will be added during implementation so bundle URLs are commit-pinned.

## Install Semantics

AoA installation will copy or fetch the full bundle directory into the requested product root:

```text
<install-root>/<skill-name>/SKILL.md
<install-root>/<skill-name>/scripts/...
<install-root>/<skill-name>/references/...
<install-root>/<skill-name>/assets/...
```

The default install folder name should be the frontmatter `name` when valid. If a nested skill has a simple valid `name`, AoA installs under that name, not the nested source path. If a name conflict exists, AoA must require user choice or namespace the install path.

Installation behavior itself can be implemented in AoA after this marketplace foundation exists. This PR only supplies the metadata needed to do it correctly.

## Migration And Compatibility

This is an additive catalog schema change:

- existing consumers can keep using `resourceUrl`
- new consumers can use `bundle`
- plugin/agent/team catalog items do not need `bundle`

All currently imported skill items should gain bundle metadata. For the current trusted import branch, that means 114 skill items out of 118 total catalog items:

- 17 Anthropic skills
- 32 Microsoft Azure skills
- 51 gstack skills
- 14 superpowers skills

The remaining 4 AoA-curated plugin items do not need skill bundle metadata.

## Testing Requirements

Implementation must be test-driven.

Required test coverage:

- catalog schema accepts `bundle` and skill frontmatter metadata
- frontmatter parser preserves `license`, `compatibility`, `metadata`, `allowed-tools`, `user-invocable`, and `disable-model-invocation`
- GitHub adapter emits bundle metadata for flat skills
- GitHub adapter emits bundle metadata for nested skills
- GitHub adapter fixture with `scripts/`, `references/`, and `assets/` still points bundle at the whole directory
- Anthropic adapter emits bundle metadata for `skills/<slug>`
- validator rejects path traversal in `bundle.path`
- validator warns for broad `allowed-tools`
- aggregate output has bundle metadata for every skill item
- aggregate output includes sample bundle paths for Anthropic, Azure flat, and Azure nested skills

Verification commands:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm validate
pnpm aggregate
```

Full monorepo `pnpm test` remains outside the completion gate while unrelated plugin-package failures exist.

## Success Criteria

- Every skill catalog item has `bundle` metadata.
- The existing trusted imports remain present.
- The current imported skills can be installed as full directories in principle.
- `resourceUrl` continues to work for `SKILL.md` preview.
- Standard and extended frontmatter is preserved for AoA UI/install decisions.
- No product-specific install root is hardcoded into the catalog item itself.
- Catalog tests pass.
- Catalog validation reports zero errors.
