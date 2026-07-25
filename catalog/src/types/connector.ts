import { z } from "zod";
import type { TrustTier } from "./catalog.js";

/**
 * MIRROR of `packages/shared/src/mcp-connector-catalog.ts` in the AoA repo
 * (`McpConnectorCatalogEntrySchema`). This is the SECOND CDN artifact,
 * deliberately separate from catalog.json — its own schema, its own file
 * (`dist/connectors.json`), its own aggregator.
 *
 * WHY A SEPARATE ARTIFACT: catalog.json's parser rejects the WHOLE array on one
 * unknown item `type`, and the AoA sync failure path preserves the previous
 * cache — so publishing a new item type would silently freeze the catalog on
 * every older instance. Connectors therefore never touch catalog.json.
 *
 * SECRETS (D5): entries carry header/env template KEYS only — never a value,
 * never a placeholder in the *Keys arrays. The founder binds a real secret after
 * install. The charset regexes below are the enforcement, not just documentation:
 * they exclude exactly the characters (`:`, `=`, whitespace) that would let a
 * "key" smuggle a `Name: value` pair — a whole credential — past the schema and
 * into a downstream header/env-map writer.
 *
 * Keep this in lockstep with the AoA-side schema. If AoA adds a field, add it
 * here; if the two drift, the emitted connectors.json can carry keys the AoA
 * parser strips (forward-compat) but never keys it rejects.
 */

const SERVER_NAME_RE = /^[a-z0-9-]+$/;
// RFC 7230 §3.2.6 token charset for HTTP header field-names (no `:`, no whitespace).
const HEADER_NAME_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
// POSIX environment-variable name charset (no `=`, no whitespace).
const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Fail-closed: an entry with no trust block is community, never verified. */
export const McpConnectorTrustSchema = z
  .object({
    tier: z.enum(["verified", "community", "unverified"]).default("community"),
  })
  .default({ tier: "community" });

export const McpConnectorCatalogEntrySchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    serverName: z.string().regex(SERVER_NAME_RE),
    transport: z.enum(["http", "stdio"]),
    url: z.string().url().optional(),
    command: z.string().min(1).optional(),
    args: z.array(z.string()).default([]),
    /** Header NAMES this connector authenticates with. Values never appear here. */
    headerTemplateKeys: z.array(z.string().regex(HEADER_NAME_RE)).default([]),
    /** Env var NAMES a stdio server expects. Values never appear here. */
    envTemplateKeys: z.array(z.string().regex(ENV_NAME_RE)).default([]),
    requiresSecret: z.boolean().default(false),
    /**
     * OAuth-ONLY remote server (e.g. Notion's hosted `mcp.notion.com`): it rejects
     * a bearer token and demands an interactive browser OAuth flow, so it CANNOT
     * work headlessly under our token model. A VALID catalog entry — meant to be
     * SHOWN, clearly labelled "needs OAuth" — but NOT installable until the OAuth
     * broker lands (Plan 4).
     */
    requiresOAuth: z.boolean().default(false),
    secretLabel: z.string().max(200).optional(),
    docsUrl: z.string().url().optional(),
    trust: McpConnectorTrustSchema,
  })
  // FU-22 — `.strip()`, NOT `.strict()`. A purely additive optional field on a
  // newer connectors.json (say `iconUrl`) must NOT fail the entry. `.strip()`
  // drops the unknown key and validates the known shape. The secret-smuggling
  // property SURVIVES: `.strip()` removes ANY unknown key, so a value-bearing
  // `headerTemplate`/`envTemplate` object (vs the `*Keys` arrays) is stripped
  // harmlessly. Trust cannot be self-promoted either: a top-level
  // `verified`/`tier`/`trustTier` is stripped; the real `trust` stays enum-
  // validated and fail-closed to `community`.
  .strip()
  .superRefine((val, ctx) => {
    if (val.transport === "http") {
      if (!val.url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "http transport requires url" });
      }
      if (val.command !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["command"], message: "http transport forbids command" });
      }
    } else if (val.transport === "stdio") {
      if (!val.command) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["command"], message: "stdio transport requires command" });
      }
      if (val.url !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "stdio transport forbids url" });
      }
    }
    // requiresOAuth + requiresSecret is incoherent: an OAuth-only server has no
    // token slot to bind, and marking it requiresSecret would render a "bind a
    // secret" affordance for a card that can only ever OAuth. Reject the nonsense.
    if (val.requiresOAuth && val.requiresSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiresOAuth"],
        message: "requiresOAuth and requiresSecret are mutually exclusive",
      });
    }
    // An OAuth-only server binds no token, so it must carry no secret-template
    // keys — otherwise a downstream writer could try to inject where nothing goes.
    if (val.requiresOAuth && (val.headerTemplateKeys.length > 0 || val.envTemplateKeys.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiresOAuth"],
        message: "requiresOAuth entries must not declare header/env template keys",
      });
    }
  });

export type McpConnectorCatalogEntry = z.infer<typeof McpConnectorCatalogEntrySchema>;

export interface ConnectorsFile {
  schemaVersion: string;
  generatedAt: string;
  entryCount: number;
  entries: McpConnectorCatalogEntry[];
}

/**
 * Defence-in-depth secret-value scan, complementary to the charset regexes above
 * (which already reject a `Name: value` template key). This catches a credential
 * accidentally hard-coded into `args`/`url`/`command` — the EXECUTION-bearing
 * fields the schema cannot charset-constrain because they legitimately hold free
 * text. `secretLabel` is deliberately NOT scanned: it is a human-facing hint that
 * legitimately spells out a credential FORMAT (e.g. "postgresql://user:password@host")
 * without carrying a real value.
 *
 * `${TOKEN}` (and any `${...}` placeholder) is the SANCTIONED indirection AoA's
 * `buildConnectorSpecs` rewrites at delivery time, so it is explicitly allowed.
 * Everything that looks like a real live credential is not.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{16,}/, // OpenAI-style keys
  /\bghp_[A-Za-z0-9]{20,}/, // GitHub PAT
  /\bgithub_pat_[A-Za-z0-9_]{20,}/, // GitHub fine-grained PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /\bBearer\s+[A-Za-z0-9._-]{12,}/i, // an inline bearer credential
  /:\/\/[^/\s:]+:[^/\s@]+@/, // user:password@ in a URL
];

export function findSecretValue(entry: unknown): string | null {
  const strings: string[] = [];
  const e = entry as Record<string, unknown>;
  for (const key of ["url", "command"]) {
    if (typeof e[key] === "string") strings.push(e[key] as string);
  }
  if (Array.isArray(e.args)) {
    for (const a of e.args) if (typeof a === "string") strings.push(a);
  }
  for (const s of strings) {
    for (const re of SECRET_VALUE_PATTERNS) {
      if (re.test(s)) return s;
    }
  }
  return null;
}

/**
 * Clamp an entry's DECLARED trust tier to the source ceiling. The marketplace's
 * trust model is source-based (`trusted-sources.json`, keyed by adapter): an
 * entry may not self-assert a tier ABOVE what its source authorises. Connectors
 * are all hand-curated under one source (`aoa-connectors`), so the ceiling is
 * that source's tier. `min(declared, ceiling)` lets a curator DOWNGRADE a single
 * entry (community/unverified) from their verification, while making it
 * impossible for any entry to exceed the source authority — if the source is
 * ever demoted to `community`, every connector caps at `community` regardless of
 * what its file claims.
 */
const TIER_WEIGHT: Record<TrustTier, number> = { unverified: 1, community: 2, verified: 3 };

export function clampTrustTier(declared: TrustTier, ceiling: TrustTier): TrustTier {
  return TIER_WEIGHT[declared] <= TIER_WEIGHT[ceiling] ? declared : ceiling;
}
