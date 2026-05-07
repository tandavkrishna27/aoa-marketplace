import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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

    const resolved: ResolvedSource[] = [];
    for (const s of ourSources) {
      try {
        const config = GithubSkillsSourceConfigSchema.parse(s.config);
        resolved.push({ config, tier: s.tier, reason: s.reason });
      } catch (err) {
        ctx.logger.error(`Invalid github-skills source config: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Cloning happens in next task. For now, return placeholders.
    return {
      sources: resolved.map((r) => ({ ...r, cloneDir: "", sourceCommitSha: "" })),
    };
  },

  async normalize(_raw: unknown, _ctx: SourceAdapterContext): Promise<NormalizedItem[]> {
    throw new Error("not implemented yet");
  },
};
