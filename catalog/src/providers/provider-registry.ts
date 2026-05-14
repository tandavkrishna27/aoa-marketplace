import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { CatalogItem, ProviderRef } from "../types/catalog.js";

const ProviderEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  homepageUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  fallbackInitials: z.string().min(1).max(6),
  repos: z.array(z.string().regex(/^[^/]+\/[^/]+$/)).min(1),
});

const ProviderRegistryFileSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  providers: z.array(ProviderEntrySchema),
});

export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

export interface ProviderRegistry {
  providers: ProviderEntry[];
  byRepo: Map<string, ProviderEntry>;
}

export function loadProviderRegistry(root: string): ProviderRegistry {
  const registryPath = join(root, "content", "providers.json");
  if (!existsSync(registryPath)) {
    return { providers: [], byRepo: new Map() };
  }

  const parsed = ProviderRegistryFileSchema.parse(JSON.parse(readFileSync(registryPath, "utf-8")));
  const byRepo = new Map<string, ProviderEntry>();
  for (const provider of parsed.providers) {
    for (const repo of provider.repos) {
      byRepo.set(repo, provider);
    }
  }
  return { providers: parsed.providers, byRepo };
}

export function resolveProviderForItem(item: CatalogItem, registry: ProviderRegistry): ProviderRef {
  const repo = item.skill?.bundle.repo ?? repoFromSourceUrl(item.source.url);
  if (repo) {
    const provider = registry.byRepo.get(repo);
    if (provider) {
      return providerRef(provider);
    }

    const owner = repo.split("/")[0];
    return {
      id: sanitizeId(owner),
      name: titleize(owner),
      logoUrl: `https://github.com/${owner}.png`,
      fallbackInitials: initials(owner),
    };
  }

  const aoaProvider = registry.byRepo.get("MeteoriteLabs/aoa-marketplace");
  if (item.source.adapter === "aoa-curated" && aoaProvider) {
    return providerRef(aoaProvider);
  }

  return {
    id: "unknown",
    name: "Unknown Provider",
    fallbackInitials: "?",
  };
}

function providerRef(provider: ProviderEntry): ProviderRef {
  return {
    id: provider.id,
    name: provider.name,
    homepageUrl: provider.homepageUrl,
    logoUrl: provider.logoUrl,
    fallbackInitials: provider.fallbackInitials,
  };
}

function repoFromSourceUrl(url: string): string | undefined {
  const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)(?:\/|$)/);
  return match?.[1];
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function initials(value: string): string {
  const words = value.split(/[-_\s]+/).filter(Boolean);
  const chars = words.length > 1 ? words.map((word) => word[0]) : [value[0], value[1]];
  return chars.join("").toUpperCase().slice(0, 3) || "?";
}
