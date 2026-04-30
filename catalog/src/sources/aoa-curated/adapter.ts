import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { SourceAdapter, SourceAdapterContext, NormalizedItem } from "../../types/source-adapter.js";
import type { CatalogItem, ItemType } from "../../types/catalog.js";
import { CategorySchema, TagSchema } from "../../types/catalog.js";

function fileAddedAt(filePath: string): string {
  // Use the file's mtime as a deterministic "added at" timestamp.
  // For first-class provenance, M.1.5+ could replace with the git first-commit timestamp.
  return statSync(filePath).mtime.toISOString();
}

interface PluginManifest {
  id: string;
  displayName: string;
  description: string;
  version: string;
  license?: string;
  capabilities?: string[];
  capabilityDescriptions?: Record<string, string>;
  marketplace?: {
    category?: string;
    tags?: string[];
    featured?: boolean;
  };
}

interface PluginPackageJson {
  name: string;
  version: string;
  description?: string;
  repository?: { url?: string; directory?: string };
  license?: string;
}

interface ContentManifest {
  id?: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags?: string[];
  capabilities?: Array<{ id: string; description: string }>;
  requires?: Array<{ type: ItemType; id: string; versionRange?: string }>;
  contentInline?: boolean;
  sourceUrl: string;
  license?: string;
  featured?: boolean;
}

const NON_PLUGIN_TYPES: Exclude<ItemType, "plugin">[] = ["skill", "agent", "team"];

// Directory names under content/ are plural (skills, agents, teams)
const TYPE_DIR_MAP: Record<Exclude<ItemType, "plugin">, string> = {
  skill: "skills",
  agent: "agents",
  team: "teams",
};

export const aoaCuratedAdapter: SourceAdapter = {
  id: "aoa-curated",
  displayName: "AoA Curated",
  defaultTrustTier: "verified",

  async fetch(ctx: SourceAdapterContext): Promise<{ repoRoot: string }> {
    // For aoa-curated, the source is the local monorepo — no network fetch.
    // ctx.workDir = monorepo root.
    return { repoRoot: ctx.workDir };
  },

  async normalize(raw: unknown, ctx: SourceAdapterContext): Promise<NormalizedItem[]> {
    const { repoRoot } = raw as { repoRoot: string };
    const items: NormalizedItem[] = [];

    // Scan plugins/ — each subdirectory is a pnpm workspace package
    const pluginsRoot = join(repoRoot, "plugins");
    if (existsSync(pluginsRoot)) {
      for (const slug of readdirSync(pluginsRoot)) {
        const pkgDir = join(pluginsRoot, slug);
        if (!statSync(pkgDir).isDirectory()) continue;

        const pkgJsonPath = join(pkgDir, "package.json");
        const manifestPath = join(pkgDir, "manifest.json");
        if (!existsSync(pkgJsonPath) || !existsSync(manifestPath)) {
          ctx.logger.warn(`Plugin ${slug} missing package.json or manifest.json`);
          continue;
        }

        let pkg: PluginPackageJson;
        let manifest: PluginManifest;
        try {
          pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as PluginPackageJson;
          manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as PluginManifest;

          const capabilities = (manifest.capabilities ?? []).map((capId) => ({
            id: capId,
            description: manifest.capabilityDescriptions?.[capId] ?? capId,
          }));

          const item: CatalogItem = {
            id: `plugin:aoa-curated/${slug}`,
            type: "plugin",
            name: manifest.displayName,
            description: manifest.description,
            version: manifest.version,
            source: {
              adapter: "aoa-curated",
              url: pkg.repository?.url
                ? `${pkg.repository.url}${pkg.repository.directory ? `/tree/main/${pkg.repository.directory}` : ""}`
                : `https://npmjs.com/package/${pkg.name}`,
              locator: `plugins/${slug}`,
            },
            trust: { tier: "verified", source: "aoa-curated" },
            status: "active",
            addedAt: fileAddedAt(manifestPath),
            capabilities,
            category: CategorySchema.parse(manifest.marketplace?.category ?? "integrations"),
            tags: z.array(TagSchema).parse(manifest.marketplace?.tags ?? []),
            featured: manifest.marketplace?.featured,
          };
          items.push({ item, rawManifest: manifest as unknown as Record<string, unknown> });
        } catch (err) {
          ctx.logger.error(`Failed to parse JSON for plugin "${slug}": ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }
      }
    } else {
      ctx.logger.info("No plugins/ directory found");
    }

    // Scan content/{type}/{slug}/ for non-plugin content
    const contentRoot = join(repoRoot, "content");
    if (!existsSync(contentRoot)) {
      ctx.logger.info("No content/ directory found");
      return items;
    }

    for (const type of NON_PLUGIN_TYPES) {
      const typeDirName = TYPE_DIR_MAP[type];
      const typeDir = join(contentRoot, typeDirName);
      if (!existsSync(typeDir) || !statSync(typeDir).isDirectory()) continue;

      for (const slug of readdirSync(typeDir)) {
        const itemDir = join(typeDir, slug);
        if (!statSync(itemDir).isDirectory()) continue;

        const manifestPath = join(itemDir, "manifest.json");
        if (!existsSync(manifestPath)) {
          ctx.logger.warn(`Missing manifest.json: ${itemDir}`);
          continue;
        }

        let raw: ContentManifest;
        try {
          raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as ContentManifest;

          const id = raw.id ?? `${type}:aoa-curated/${slug}`;

          let content: { inline?: string; url?: string } | undefined;
          if (raw.contentInline) {
            const readmePath = join(itemDir, "README.md");
            if (existsSync(readmePath)) {
              content = { inline: readFileSync(readmePath, "utf-8") };
            }
          }

          const item: CatalogItem = {
            id,
            type,
            name: raw.name,
            description: raw.description,
            version: raw.version,
            source: {
              adapter: "aoa-curated",
              url: raw.sourceUrl,
              locator: `content/${typeDirName}/${slug}`,
            },
            trust: { tier: "verified", source: "aoa-curated" },
            status: "active",
            addedAt: fileAddedAt(manifestPath),
            category: CategorySchema.parse(raw.category),
            tags: z.array(TagSchema).parse(raw.tags ?? []),
            capabilities: raw.capabilities,
            requires: raw.requires,
            content,
            featured: raw.featured,
          };
          items.push({ item, rawManifest: raw as unknown as Record<string, unknown> });
        } catch (err) {
          ctx.logger.error(`Failed to parse manifest for content/${type}/${slug}: ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }
      }
    }

    return items;
  },
};
