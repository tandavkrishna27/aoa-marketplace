import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import type { SourceAdapter, SourceAdapterContext, NormalizedItem } from "../../types/source-adapter.js";
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

  async normalize(_raw: unknown, _ctx: SourceAdapterContext): Promise<NormalizedItem[]> {
    throw new Error("not implemented yet");
  },
};
