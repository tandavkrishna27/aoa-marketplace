import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SourceAdapter, SourceAdapterContext } from "../../types/source-adapter.js";
import type { CatalogItem, ItemType } from "../../types/catalog.js";

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

  async normalize(raw: unknown, ctx: SourceAdapterContext): Promise<CatalogItem[]> {
    const { repoRoot } = raw as { repoRoot: string };
    const items: CatalogItem[] = [];

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

        const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as PluginPackageJson;
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as PluginManifest;

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
          addedAt: new Date().toISOString(),
          capabilities,
          category: (manifest.marketplace?.category ?? "integrations") as never,
          tags: (manifest.marketplace?.tags ?? []) as never,
          featured: manifest.marketplace?.featured,
        };
        items.push(item);
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

        const rawManifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ContentManifest;
        const id = rawManifest.id ?? `${type}:aoa-curated/${slug}`;

        let content: { inline?: string; url?: string } | undefined;
        if (rawManifest.contentInline) {
          const readmePath = join(itemDir, "README.md");
          if (existsSync(readmePath)) {
            content = { inline: readFileSync(readmePath, "utf-8") };
          }
        }

        const item: CatalogItem = {
          id,
          type,
          name: rawManifest.name,
          description: rawManifest.description,
          version: rawManifest.version,
          source: {
            adapter: "aoa-curated",
            url: rawManifest.sourceUrl,
            locator: `content/${typeDirName}/${slug}`,
          },
          trust: { tier: "verified", source: "aoa-curated" },
          status: "active",
          addedAt: new Date().toISOString(),
          category: rawManifest.category as never,
          tags: (rawManifest.tags ?? []) as never,
          capabilities: rawManifest.capabilities,
          requires: rawManifest.requires,
          content,
          featured: rawManifest.featured,
        };
        items.push(item);
      }
    }

    return items;
  },
};
