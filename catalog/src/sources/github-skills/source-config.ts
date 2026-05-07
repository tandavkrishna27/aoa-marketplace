import { z } from "zod";

export const GithubSkillsSourceConfigSchema = z.object({
  /** GitHub repo identifier in `owner/name` form */
  repo: z.string().regex(/^[^/]+\/[^/]+$/, "repo must be in owner/repo form"),

  /** Branch, tag, or commit SHA to clone */
  ref: z.string().min(1),

  /** Subpath within the repo to scan for SKILL.md files (default: root) */
  skillsPath: z.string().default(""),

  /** Glob patterns to exclude */
  ignore: z.array(z.string()).default([]),

  /** Default category if SKILL.md frontmatter doesn't specify one */
  defaultCategory: z.string().optional(),
});

export type GithubSkillsSourceConfig = z.infer<typeof GithubSkillsSourceConfigSchema>;
