import { z } from "zod";

export const CategorySchema = z.enum([
  "engineering", "marketing", "support", "sales", "operations",
  "design", "data", "productivity", "integrations", "workflows",
]);
export type Category = z.infer<typeof CategorySchema>;

export const TagSchema = z.enum([
  "new", "featured", "enterprise", "solo-friendly",
  "requires-api-key", "official", "partner",
]);
export type Tag = z.infer<typeof TagSchema>;

export const TrustTierSchema = z.enum(["verified", "community", "unverified"]);
export type TrustTier = z.infer<typeof TrustTierSchema>;

export const ItemTypeSchema = z.enum(["skill", "plugin", "agent", "team"]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const SourceRefSchema = z.object({
  adapter: z.string(),
  url: z.string().url(),            // informational; may be branch-relative for legacy items
  locator: z.string(),
  commitSha: z.string().optional(), // git commit SHA at aggregation time, used to pin resourceUrl
});

export const NpmRefSchema = z.object({
  packageName: z.string().min(1),
  version: z.string().min(1),
  tarballUrl: z.string().url().optional(),
});

export const TrustRefSchema = z.object({
  tier: TrustTierSchema,
  source: z.string(),
  reviewer: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  reviewedVersion: z.string().optional(),
});

export const CapabilitySchema = z.object({
  id: z.string(),
  description: z.string(),
});

export const RequiresSchema = z.object({
  type: ItemTypeSchema,
  id: z.string(),
  versionRange: z.string().optional(),
});

export const ContentSchema = z.object({
  inline: z.string().optional(),
  url: z.string().url().optional(),
}).refine(
  (c) => c.inline !== undefined || c.url !== undefined,
  { message: "content must have either inline or url" },
);

export const CatalogItemSchema = z.object({
  id: z.string(),
  type: ItemTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string(), // semver, validated by validator
  source: SourceRefSchema,
  trust: TrustRefSchema,
  status: z.enum(["active", "deprecated", "quarantined"]),
  addedAt: z.string().datetime(),
  capabilities: z.array(CapabilitySchema).optional(),
  requires: z.array(RequiresSchema).optional(),
  content: ContentSchema.optional(),
  category: CategorySchema,
  tags: z.array(TagSchema),
  featured: z.boolean().optional(),
  // M.2.0: install-related fields
  npm: NpmRefSchema.optional(),         // present on plugin items: { packageName, version } for pluginLoader.installPlugin()
  resourceUrl: z.string().url().optional(), // present on snapshot items (skill/agent/team): commit-pinned raw.githubusercontent URL
  // NEW: runtime primitives this skill needs at agent runtime — purely declarative,
  // does not block install. Surfaced as a warning banner on AoA's install modal.
  runtimeRequires: z.array(z.string()).optional(),
});
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const CATALOG_SCHEMA_VERSION = "1.0.0" as const;

export const CatalogFileSchema = z.object({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  generatedAt: z.string().datetime(),
  itemCount: z.number().int().min(0),
  items: z.array(CatalogItemSchema),
});
export type CatalogFile = z.infer<typeof CatalogFileSchema>;
