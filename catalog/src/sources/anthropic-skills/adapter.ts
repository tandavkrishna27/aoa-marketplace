import { mkdtempSync, readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { CategorySchema, TagSchema } from "../../types/catalog.js";
import type { SourceAdapter, SourceAdapterContext, NormalizedItem } from "../../types/source-adapter.js";
import type { CatalogItem, Category } from "../../types/catalog.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";

const SKILLS_REPO_URL = "https://github.com/anthropics/skills.git";

interface FetchedRepo {
  cloneDir: string;
  cloneTimestamp: string; // ISO; used as deterministic addedAt fallback
}

export const anthropicSkillsAdapter: SourceAdapter = {
  id: "anthropic-skills",
  displayName: "Anthropic Skills",
  defaultTrustTier: "verified",

  async fetch(ctx: SourceAdapterContext): Promise<FetchedRepo> {
    // TODO M.1.E: extend SourceAdapter interface with cleanup(raw) lifecycle method;
    // currently the cloneDir is leaked. tmpdir() will eventually be cleaned by the OS.
    const cloneDir = mkdtempSync(join(tmpdir(), "anthropic-skills-"));
    ctx.logger.info(`Cloning ${SKILLS_REPO_URL} → ${cloneDir}`);
    const result = spawnSync("git", ["clone", "--depth=1", SKILLS_REPO_URL, cloneDir], {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 60_000,
    });
    if (result.status !== 0) {
      throw new Error(`git clone failed: ${result.stderr}`);
    }
    return { cloneDir, cloneTimestamp: new Date().toISOString() };
  },

  async normalize(raw: unknown, ctx: SourceAdapterContext): Promise<NormalizedItem[]> {
    const { cloneDir, cloneTimestamp } = raw as FetchedRepo;
    const items: NormalizedItem[] = [];
    const { root: skillsRoot, urlPrefix } = resolveSkillsRoot(cloneDir);

    // Anthropic's skills repo structure: each folder under skills/ is a skill.
    // Inside each: a SKILL.md file with the markdown content + frontmatter.
    for (const entry of readdirSync(skillsRoot)) {
      const entryPath = join(skillsRoot, entry);
      if (!statSync(entryPath).isDirectory()) continue;
      if (entry.startsWith(".")) continue; // skip .git, etc.

      const skillFile = join(entryPath, "SKILL.md");
      if (!existsSync(skillFile)) {
        ctx.logger.warn(`No SKILL.md in ${entryPath}`);
        continue;
      }

      // Wrap per-item parsing in try/catch so one bad skill doesn't crash the whole run
      try {
        const content = readFileSync(skillFile, "utf-8");
        const { name, description, version } = parseFrontmatter(content, entry);
        const sourcePath = urlPrefix ? `${urlPrefix}/${entry}` : entry;

        // Use file's mtime as the deterministic addedAt — falls back to cloneTimestamp if mtime unavailable.
        // mtime is the file's last-modified time in the local clone; fresh on every clone but consistent within a run.
        let addedAt: string;
        try {
          addedAt = statSync(skillFile).mtime.toISOString();
        } catch {
          addedAt = cloneTimestamp;
        }

        const item: CatalogItem = {
          id: `skill:anthropic/${entry}`,
          type: "skill",
          name,
          description,
          version,
          source: {
            adapter: "anthropic-skills",
            url: `https://github.com/anthropics/skills/tree/main/${sourcePath}`,
            locator: sourcePath,
          },
          trust: { tier: "verified", source: "anthropic-skills" },
          status: "active",
          addedAt,
          category: CategorySchema.parse(inferCategory(name, description)),
          tags: z.array(TagSchema).parse(["official"]),
          content: { inline: content },
        };
        // Anthropic Skills frontmatter has no license field — omit rawManifest so the
        // license check is skipped for these trusted-source items.
        items.push({ item });
      } catch (err) {
        ctx.logger.error(`Failed to process skill "${entry}": ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
    }

    return items;
  },
};

function resolveSkillsRoot(cloneDir: string): { root: string; urlPrefix: string } {
  const currentLayout = join(cloneDir, "skills");
  if (existsSync(currentLayout)) {
    return { root: currentLayout, urlPrefix: "skills" };
  }
  return { root: cloneDir, urlPrefix: "" };
}

function inferCategory(name: string, description: string): Category {
  const text = `${name} ${description}`.toLowerCase();
  if (/\b(code|engineer|debug|test|review|git|deploy)\b/.test(text)) return "engineering";
  if (/\b(market|seo|social|campaign)\b/.test(text)) return "marketing";
  if (/\b(support|ticket|customer|help)\b/.test(text)) return "support";
  if (/\b(sales|lead|deal|crm)\b/.test(text)) return "sales";
  if (/\b(design|ux|ui|figma)\b/.test(text)) return "design";
  if (/\b(data|analytics|sql|metric)\b/.test(text)) return "data";
  return "productivity"; // default
}
