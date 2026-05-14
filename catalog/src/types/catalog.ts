import { z } from "zod";

export const CategorySchema = z.enum([
  "engineering", "marketing", "support", "sales", "operations",
  "design", "data", "productivity", "integrations", "workflows",
]);
export type Category = z.infer<typeof CategorySchema>;

export const TagSchema = z.enum([
  "new", "featured", "enterprise", "solo-friendly",
  "requires-api-key", "official", "partner",
  "requires-cli-tooling",  // NEW: auto-applied when runtimeRequires is non-empty
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

export const ProviderRefSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  homepageUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  fallbackInitials: z.string().min(1).max(6),
});
export type ProviderRef = z.infer<typeof ProviderRefSchema>;

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

export const SkillBundleSchema = z.object({
  type: z.literal("github-directory"),
  repo: z.string().regex(/^[^/]+\/[^/]+$/),
  commitSha: z.string().min(7),
  path: z.string().min(1),
  treeUrl: z.string().url(),
});
export type SkillBundle = z.infer<typeof SkillBundleSchema>;

export const SkillFrontmatterSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  allowedTools: z.string().optional(),
  userInvocable: z.boolean().optional(),
  disableModelInvocation: z.boolean().optional(),
  raw: z.record(z.unknown()).default({}),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export const SkillMetadataSchema = z.object({
  bundle: SkillBundleSchema,
  frontmatter: SkillFrontmatterSchema,
});
export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

export const CatalogItemSchema = z.object({
  id: z.string(),
  type: ItemTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string(), // semver, validated by validator
  source: SourceRefSchema,
  provider: ProviderRefSchema.optional(),
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
  skill: SkillMetadataSchema.optional(),
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
