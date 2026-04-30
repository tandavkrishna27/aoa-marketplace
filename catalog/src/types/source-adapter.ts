import type { CatalogItem } from "./catalog.js";

export interface SourceAdapterContext {
  readonly workDir: string;     // tmp dir per adapter run
  readonly logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
  readonly commitSha: string;   // M.2.0: git HEAD SHA captured at aggregation time, used to pin resourceUrl
}

/** A parsed CatalogItem paired with the raw manifest object it came from.
 *  rawManifest is optional — adapters that don't have a manifest file (e.g. anthropic-skills)
 *  may omit it; the license check will be skipped for those items. */
export interface NormalizedItem {
  item: CatalogItem;
  rawManifest?: Record<string, unknown>;
}

export interface SourceAdapter {
  /** Stable adapter identifier (e.g., "aoa-curated", "anthropic-skills") */
  readonly id: string;

  /** Human-readable name shown in catalog provenance */
  readonly displayName: string;

  /** Default trust tier for items from this source (overridable per item) */
  readonly defaultTrustTier: "verified" | "community" | "unverified";

  /** Fetch raw source data (git clone, HTTP fetch, file scan, etc.) */
  fetch(ctx: SourceAdapterContext): Promise<unknown>;

  /** Convert raw data to canonical NormalizedItem entries (item + optional rawManifest) */
  normalize(raw: unknown, ctx: SourceAdapterContext): Promise<NormalizedItem[]>;
}
