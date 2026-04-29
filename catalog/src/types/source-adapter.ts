import type { CatalogItem } from "./catalog.js";

export interface SourceAdapterContext {
  readonly workDir: string;     // tmp dir per adapter run
  readonly logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
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

  /** Convert raw data to canonical CatalogItem entries */
  normalize(raw: unknown, ctx: SourceAdapterContext): Promise<CatalogItem[]>;
}
