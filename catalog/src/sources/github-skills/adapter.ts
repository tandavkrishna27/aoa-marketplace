import { readFileSync, existsSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import type { SourceAdapter, SourceAdapterContext, NormalizedItem } from "../../types/source-adapter.js";
import type { CatalogItem } from "../../types/catalog.js";
import { CategorySchema, TagSchema } from "../../types/catalog.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";
import { loadSkillOverrides, mergeRuntimeRequires } from "./overrides.js";
import { GithubSkillsSourceConfigSchema, type GithubSkillsSourceConfig } from "./source-config.js";

const TrustedSourcesFileSchema = z.object({
  schemaVersion: z.string(),
  trustedSources: z.array(
    z.object({
      adapter: z.string(),
      tier: z.enum(["verified", "community", "unverified"]),
      reason: z.string(),
      config: z.unknown().optional(),
    }),
  ),
});

interface ResolvedSource {
  config: GithubSkillsSourceConfig;
  tier: "verified" | "community" | "unverified";
  reason: string;
}

interface FetchResult {
  sources: Array<ResolvedSource & { cloneDir: string; sourceCommitSha: string }>;
}

function resolveCloneUrl(repo: string): string {
  const override = process.env.GITHUB_SKILLS_TEST_OVERRIDE_REPO;
  if (override) {
    for (const pair of override.split(",")) {
      const [k, v] = pair.split("=");
      if (k.trim() === repo) return v.trim();
    }
  }
  return `https://github.com/${repo}.git`;
}

function walkSkillFiles(dir: string, ignore: string[], rootDir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = full.slice(rootDir.length + 1).replace(/\\/g, "/");
    if (matchesAny(rel, ignore)) continue;
    if (statSync(full).isDirectory()) {
      out.push(...walkSkillFiles(full, ignore, rootDir));
    } else if (entry === "SKILL.md") {
      out.push(full);
    }
  }
  return out;
}

function matchesAny(rel: string, patterns: string[]): boolean {
  for (const p of patterns) {
    // Escape regex specials, but leave * and / untouched so the glob substitutions below work.
    const escaped = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    // Minimal glob: supports ** (any path segments, including zero) and * (within one segment).
    // "**/.factory/**" should match ".factory", ".factory/skip", ".factory/skip/SKILL.md"
    // because the leading "**/" means "zero or more path segments/"
    const reStr = escaped
      .replace(/\*\*/g, "<<dstar>>")
      .replace(/\*/g, "[^/]*")
      // "<<dstar>>/" at start means "zero or more leading segments and slash"
      .replace(/^<<dstar>>\//g, "(?:.+/)?")
      // "/<dstar>>" at end means "slash and zero or more trailing segments"
      .replace(/\/<<dstar>>$/g, "(?:/.+)?")
      // remaining <<dstar>> (mid-pattern) matches anything
      .replace(/<<dstar>>/g, ".*");
    const re = new RegExp("^" + reStr + "$");
    if (re.test(rel)) return true;
  }
  return false;
}

function detectLicense(cloneDir: string): string | undefined {
  const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"];
  for (const name of candidates) {
    const path = join(cloneDir, name);
    if (existsSync(path)) {
      const head = readFileSync(path, "utf-8").slice(0, 200);
      // Crude SPDX-ish detection. Source manifests can carry an explicit `license`
      // field (preferred) — this is the fallback for upstream repos that only ship
      // a LICENSE file. Update if more permissive ones come up.
      if (/MIT License/i.test(head)) return "MIT";
      if (/Apache License.*Version 2\.0/is.test(head)) return "Apache-2.0";
      if (/BSD 3-Clause/i.test(head)) return "BSD-3-Clause";
      if (/BSD 2-Clause/i.test(head)) return "BSD-2-Clause";
      if (/ISC License/i.test(head)) return "ISC";
    }
  }
  return undefined;
}

export const githubSkillsAdapter: SourceAdapter = {
  id: "github-skills",
  displayName: "GitHub Skills",
  defaultTrustTier: "community",

  async fetch(ctx: SourceAdapterContext): Promise<FetchResult> {
    const tsPath = join(ctx.workDir, "trusted-sources.json");
    if (!existsSync(tsPath)) {
      ctx.logger.warn(`No trusted-sources.json at ${tsPath} — github-skills adapter has nothing to do`);
      return { sources: [] };
    }
    const parsed = TrustedSourcesFileSchema.parse(JSON.parse(readFileSync(tsPath, "utf-8")));
    const ourSources = parsed.trustedSources.filter((s) => s.adapter === "github-skills");

    const cloned: Array<ResolvedSource & { cloneDir: string; sourceCommitSha: string }> = [];
    for (const s of ourSources) {
      let config: GithubSkillsSourceConfig;
      try {
        config = GithubSkillsSourceConfigSchema.parse(s.config);
      } catch (err) {
        ctx.logger.error(`Invalid github-skills source config: ${err instanceof Error ? err.message : err}`);
        continue;
      }

      const cloneDir = mkdtempSync(join(tmpdir(), `gh-skills-${config.repo.replace("/", "-")}-`));
      const url = resolveCloneUrl(config.repo);
      ctx.logger.info(`Cloning ${url} (ref=${config.ref}) → ${cloneDir}`);
      const cloneResult = spawnSync(
        "git",
        ["clone", "--depth=1", `--branch=${config.ref}`, url, cloneDir],
        { encoding: "utf-8", timeout: 120_000 },
      );
      if (cloneResult.status !== 0) {
        ctx.logger.error(`git clone failed for ${config.repo}: ${cloneResult.stderr}`);
        continue;
      }
      const shaResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: cloneDir, encoding: "utf-8" });
      const sourceCommitSha = shaResult.stdout.trim();
      cloned.push({ config, tier: s.tier, reason: s.reason, cloneDir, sourceCommitSha });
    }

    return { sources: cloned };
  },

  async normalize(raw: unknown, ctx: SourceAdapterContext): Promise<NormalizedItem[]> {
    const { sources } = raw as FetchResult;
    const overrides = loadSkillOverrides(join(ctx.workDir, "content"));
    const items: NormalizedItem[] = [];

    for (const src of sources) {
      const license = detectLicense(src.cloneDir);
      const skillsRoot = join(src.cloneDir, src.config.skillsPath);
      if (!existsSync(skillsRoot)) {
        ctx.logger.warn(`skillsPath ${src.config.skillsPath} not found in ${src.config.repo}`);
        continue;
      }
      const skillFiles = walkSkillFiles(skillsRoot, src.config.ignore, skillsRoot).sort((a, b) => {
        const aDir = a
          .slice(skillsRoot.length + 1)
          .replace(/\\/g, "/")
          .replace(/\/SKILL\.md$/, "");
        const bDir = b
          .slice(skillsRoot.length + 1)
          .replace(/\\/g, "/")
          .replace(/\/SKILL\.md$/, "");
        const depthDelta = aDir.split("/").length - bDir.split("/").length;
        if (depthDelta !== 0) return depthDelta;
        return aDir < bDir ? -1 : aDir > bDir ? 1 : 0;
      });
      ctx.logger.info(`${src.config.repo}: found ${skillFiles.length} SKILL.md files`);

      for (const skillFile of skillFiles) {
        const relPath = skillFile.slice(src.cloneDir.length + 1).replace(/\\/g, "/");
        const skillDir = skillFile
          .slice(skillsRoot.length + 1)
          .replace(/\\/g, "/")
          .replace(/\/SKILL\.md$/, "");
        const fallbackName = skillDir.split("/").pop() ?? skillDir;
        const id = `skill:github-skills/${src.config.repo}/${skillDir}`;

        try {
          const content = readFileSync(skillFile, "utf-8");
          const fm = parseFrontmatter(content, fallbackName);
          const sha = src.sourceCommitSha;
          const runtimeRequires = mergeRuntimeRequires(fm.runtimeRequires, id, overrides);

          // Category: frontmatter > source default > fallback "productivity"
          const candidate = fm.category ?? src.config.defaultCategory ?? "productivity";
          const catParsed = CategorySchema.safeParse(candidate);

          // Tags: from frontmatter (validated) plus auto-applied requires-cli-tooling
          const rawTags = (fm.tags ?? []).filter((t) => TagSchema.safeParse(t).success);
          if (runtimeRequires.length > 0 && !rawTags.includes("requires-cli-tooling")) {
            rawTags.push("requires-cli-tooling");
          }

          const item: CatalogItem = {
            id,
            type: "skill",
            name: fm.name,
            description: fm.description,
            version: fm.version,
            source: {
              adapter: "github-skills",
              url: `https://github.com/${src.config.repo}/tree/${sha}/${relPath.replace(/\/SKILL\.md$/, "")}`,
              locator: `${src.config.repo}/${relPath.replace(/\/SKILL\.md$/, "")}`,
              commitSha: ctx.commitSha,
            },
            resourceUrl: `https://raw.githubusercontent.com/${src.config.repo}/${sha}/${relPath}`,
            trust: { tier: src.tier, source: "github-skills" },
            status: "active",
            addedAt: new Date().toISOString(),
            category: catParsed.success ? catParsed.data : "productivity",
            tags: z.array(TagSchema).parse(rawTags),
            runtimeRequires: runtimeRequires.length > 0 ? runtimeRequires : undefined,
          };

          items.push({
            item,
            rawManifest: license !== undefined ? { license } : undefined,
          });
        } catch (err) {
          ctx.logger.error(`Failed to parse ${skillFile}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    return items;
  },
};
