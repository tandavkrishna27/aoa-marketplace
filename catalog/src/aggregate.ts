import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { aoaCuratedAdapter } from "./sources/aoa-curated/adapter.js";
import { anthropicSkillsAdapter } from "./sources/anthropic-skills/adapter.js";
import { runAutomatedChecks } from "./validators/automated-checks.js";
import { loadTrustedSources, resolveTrustTier } from "./validators/trust-resolver.js";
import type { CatalogFile, CatalogItem, TrustTier } from "./types/catalog.js";
import type { SourceAdapter, SourceAdapterContext, NormalizedItem } from "./types/source-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// aggregate.ts is at catalog/src/aggregate.ts → go up two levels for monorepo root
const REPO_ROOT = join(__dirname, "..", "..");

const ADAPTERS: SourceAdapter[] = [aoaCuratedAdapter, anthropicSkillsAdapter];

function getRepoCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
  } catch (err) {
    // Fail loudly — silently emitting "unknown" SHA produces broken raw.githubusercontent.com URLs
    // (404 on every snapshot install). CI uses actions/checkout@v4 which always populates HEAD.
    // Local dev: aggregator must run from inside the aoa-marketplace git checkout.
    throw new Error(
      `Cannot determine git commit SHA — aggregator must run inside a git repo. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

interface AggregateOptions {
  validateOnly: boolean;
  outputPath?: string;
}

export async function aggregate(opts: AggregateOptions = { validateOnly: false }): Promise<CatalogFile> {
  const allItems: CatalogItem[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const trustedSources = loadTrustedSources(REPO_ROOT);
  const commitSha = getRepoCommitSha();

  for (const adapter of ADAPTERS) {
    const ctx: SourceAdapterContext = {
      workDir: REPO_ROOT,
      logger: {
        info: (m) => console.log(`[${adapter.id}] ${m}`),
        warn: (m) => console.warn(`[${adapter.id}] WARN: ${m}`),
        error: (m) => console.error(`[${adapter.id}] ERROR: ${m}`),
      },
      commitSha,
    };

    try {
      const raw = await adapter.fetch(ctx);
      const normalizedItems: NormalizedItem[] = await adapter.normalize(raw, ctx);
      console.log(`[${adapter.id}] yielded ${normalizedItems.length} items`);

      for (const { item, rawManifest } of normalizedItems) {
        // Resolve trust tier (source-based unless explicitly reviewed)
        // Clone to avoid mutating adapter-produced object
        const resolvedItem: CatalogItem = {
          ...item,
          trust: { ...item.trust, tier: resolveTrustTier(item, trustedSources) },
        };

        // Run automated checks — pass rawManifest so license validation fires
        const result = runAutomatedChecks(resolvedItem, rawManifest);
        if (!result.passed) {
          errors.push(`${resolvedItem.id}: ${result.failures.join(", ")}`);
          console.error(`[${adapter.id}] REJECT ${resolvedItem.id}: ${result.failures.join(", ")}`);
          continue;
        }
        for (const w of result.warnings) {
          warnings.push(`${resolvedItem.id}: ${w}`);
        }

        allItems.push(resolvedItem);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${adapter.id}] FAILED: ${msg}`);
      errors.push(`Adapter ${adapter.id} failed: ${msg}`);
    }
  }

  // Dedupe by canonical ID — prefer higher trust tier on ties.
  // Strict `>` means first-encountered item wins on equal trust (deterministic since ADAPTERS order is fixed).
  const byId = new Map<string, CatalogItem>();
  for (const item of allItems) {
    const existing = byId.get(item.id);
    if (!existing || trustWeight(item.trust.tier) > trustWeight(existing.trust.tier)) {
      byId.set(item.id, item);
    }
  }
  const deduped = Array.from(byId.values()).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const catalog: CatalogFile = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    itemCount: deduped.length,
    items: deduped,
  };

  console.log(`\nAggregation complete: ${deduped.length} items`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);

  if (errors.length > 0 && !opts.validateOnly) {
    console.error("\nErrors found, but proceeding to write output (failed items excluded)");
  }

  if (!opts.validateOnly) {
    // Output to dist/catalog.json — CI publishes this to the root of the public CDN repo
    // (the public CDN repo's root IS the marketplace; no /marketplace/ subpath needed)
    const outPath = opts.outputPath ?? join(REPO_ROOT, "dist", "catalog.json");
    if (!existsSync(dirname(outPath))) {
      mkdirSync(dirname(outPath), { recursive: true });
    }
    writeFileSync(outPath, JSON.stringify(catalog, null, 2));
    console.log(`\nWrote ${outPath}`);
  }

  return catalog;
}

function trustWeight(tier: TrustTier): number {
  return tier === "verified" ? 3 : tier === "community" ? 2 : 1;
}

// CLI entrypoint
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const validateOnly = process.argv.includes("--validate-only");
  aggregate({ validateOnly })
    .then((catalog) => {
      if (!validateOnly && catalog.itemCount === 0) {
        console.error("ERROR: catalog is empty — refusing to overwrite dist/catalog.json");
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
