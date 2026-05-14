# Skill Bundle Installer Design

## Purpose

AoA Marketplace now records each imported skill as a GitHub directory bundle. The next step is to prove that a bundle pointer can materialize the complete skill directory locally, not only preview `SKILL.md`.

The first implementation will live in the catalog builder as a reusable utility. It will not install into product-specific roots yet. Instead, it will provide the safe primitive future install flows can call.

## Scope

Given a catalog `skill.bundle` value:

```json
{
  "type": "github-directory",
  "repo": "microsoft/azure-skills",
  "commitSha": "9d86ae4a15bcbc82bd49d908c050638d99d02e38",
  "path": "skills/azure-ai",
  "treeUrl": "https://github.com/microsoft/azure-skills/tree/9d86ae4a15bcbc82bd49d908c050638d99d02e38/skills/azure-ai"
}
```

the utility copies this directory to a caller-provided output path:

```text
<output>/
├── SKILL.md
├── scripts/
├── references/
├── assets/
└── any other regular files and directories
```

The output path is the bundle destination itself. Product-specific roots such as `.agents/skills/` or `.claude/skills/` remain outside this task.

## Architecture

Add `catalog/src/installer/skill-bundle.ts`.

The module will expose:

- `installSkillBundle(bundle, options)`
- `validateSkillBundlePath(path)`

`installSkillBundle` will:

1. Validate the bundle type and path.
2. Clone the pinned GitHub repository into a temporary directory.
3. Check out `bundle.commitSha`.
4. Verify `bundle.path/SKILL.md` exists.
5. Copy the entire bundle directory into `options.destination`.
6. Return an install result with destination path, copied file count, and copied byte count.

The first version may accept a local filesystem repository URL for tests. Real catalog bundles continue using `owner/repo` and resolve to `https://github.com/<owner>/<repo>.git`.

## Safety Rules

The utility must not execute skill files.

It must reject unsafe bundle paths:

- empty path
- absolute path
- Windows drive path
- `.` or `..` segments
- empty path segments
- NUL characters

It must reject unsafe destinations:

- destination equal to filesystem root
- destination inside the cloned source checkout

It must reject source entries that would escape the source bundle root. Symlinks are not followed in the first implementation; symlink entries are skipped rather than dereferenced.

If the destination already exists, the caller chooses behavior through `overwrite`:

- `overwrite: false` or omitted: fail if destination exists
- `overwrite: true`: remove and recreate only that destination directory after verifying it is not a filesystem root

## Testing Requirements

Tests must be written before implementation.

Required tests:

- installs `SKILL.md` and sibling files from a local Git repo fixture
- preserves nested directories such as `scripts/`, `references/`, and `assets/`
- installs a nested bundle path such as `skills/group/deep-skill`
- rejects path traversal and absolute paths
- fails when destination exists and overwrite is false
- overwrites the destination when overwrite is true
- fails when the bundle directory has no `SKILL.md`

Verification commands:

```bash
pnpm --filter @armyofagents/aoa-marketplace-builder test
pnpm validate
pnpm aggregate
```

## Success Criteria

- A complete skill directory can be materialized from a bundle pointer.
- Existing catalog generation behavior remains unchanged.
- Tests prove supporting files are copied.
- Unsafe source paths and destination behavior are covered.
- The utility is small enough for future UI/API install flows to call without knowing Git internals.
