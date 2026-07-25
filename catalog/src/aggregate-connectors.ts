import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  McpConnectorCatalogEntrySchema,
  clampTrustTier,
  findSecretValue,
  type ConnectorsFile,
  type McpConnectorCatalogEntry,
} from "./types/connector.js";
import { loadTrustedSources } from "./validators/trust-resolver.js";
import type { TrustTier } from "./types/catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// aggregate-connectors.ts is at catalog/src/ → go up two levels for monorepo root
const REPO_ROOT = join(__dirname, "..", "..");

// The single hand-curated source for connectors. Its tier in trusted-sources.json
// is the CEILING every connector entry is clamped to (see clampTrustTier). If the
// source is absent from trusted-sources.json, connectors cap at `community`
// (fail-closed) — never verified — exactly like an unknown catalog adapter.
const CONNECTOR_SOURCE_ADAPTER = "aoa-connectors";

interface AggregateConnectorsOptions {
  validateOnly: boolean;
  outputPath?: string;
}

/**
 * Resolve the trust ceiling for connectors from `trusted-sources.json`. Mirrors
 * the source-based model catalog.json uses: the source's declared tier is the
 * authority; an entry may sit at or below it, never above.
 */
export function resolveConnectorCeiling(repoRoot: string): TrustTier {
  const sources = loadTrustedSources(repoRoot);
  const source = sources.find((s) => s.adapter === CONNECTOR_SOURCE_ADAPTER);
  return source ? source.tier : "community";
}

export async function aggregateConnectors(
  opts: AggregateConnectorsOptions = { validateOnly: false },
): Promise<ConnectorsFile> {
  const entries: McpConnectorCatalogEntry[] = [];
  const dropped: string[] = [];
  const warnings: string[] = [];

  const ceiling = resolveConnectorCeiling(REPO_ROOT);
  console.log(`[connectors] trust ceiling from '${CONNECTOR_SOURCE_ADAPTER}': ${ceiling}`);

  const connectorsRoot = join(REPO_ROOT, "content", "connectors");
  if (!existsSync(connectorsRoot)) {
    console.log("[connectors] no content/connectors/ directory found");
  } else {
    for (const slug of readdirSync(connectorsRoot).sort()) {
      const dir = join(connectorsRoot, slug);
      if (!statSync(dir).isDirectory()) continue;

      const file = join(dir, "connector.json");
      if (!existsSync(file)) {
        warnings.push(`${slug}: missing connector.json`);
        console.warn(`[connectors] WARN ${slug}: missing connector.json`);
        continue;
      }

      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(file, "utf-8"));
      } catch (err) {
        dropped.push(slug);
        console.error(`[connectors] DROP ${slug}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }

      // Defence-in-depth: reject a real credential hard-coded into a free-text
      // field BEFORE it can be stripped-and-forgotten or emitted. The schema's
      // charset regexes already reject a `Name: value` template key; this covers
      // args/url/command/secretLabel.
      const leaked = findSecretValue(raw);
      if (leaked) {
        dropped.push(typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : slug);
        console.error(`[connectors] DROP ${slug}: a field appears to contain a secret value — templates carry KEYS only`);
        continue;
      }

      // Per-entry `.strip()` parse — a bad entry is dropped+warned, never fails
      // the whole file (FU-14/FU-22 forward-compat parity with the AoA side).
      const parsed = McpConnectorCatalogEntrySchema.safeParse(raw);
      if (!parsed.success) {
        const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : slug;
        dropped.push(id);
        console.error(`[connectors] DROP ${id}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        continue;
      }

      const entry = parsed.data;

      // Directory slug is authoritative for identity hygiene: the id must match
      // the folder so two files can never claim the same id from different dirs.
      if (entry.id !== slug) {
        warnings.push(`${slug}: id "${entry.id}" does not match directory name`);
        console.warn(`[connectors] WARN ${slug}: id "${entry.id}" != directory "${slug}"`);
      }

      // Source-based trust: clamp the file's self-declared tier to the ceiling.
      const resolvedTier = clampTrustTier(entry.trust.tier, ceiling);
      if (resolvedTier !== entry.trust.tier) {
        warnings.push(`${entry.id}: tier clamped ${entry.trust.tier} -> ${resolvedTier}`);
      }
      entries.push({ ...entry, trust: { ...entry.trust, tier: resolvedTier } });
    }
  }

  // Dedupe by id — deterministic, last-writer-warned.
  const byId = new Map<string, McpConnectorCatalogEntry>();
  for (const entry of entries) {
    if (byId.has(entry.id)) {
      warnings.push(`${entry.id}: duplicate id — keeping first`);
      continue;
    }
    byId.set(entry.id, entry);
  }
  const finalEntries = Array.from(byId.values()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const out: ConnectorsFile = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    entryCount: finalEntries.length,
    entries: finalEntries,
  };

  console.log(`\n[connectors] aggregation complete: ${finalEntries.length} entries`);
  console.log(`  Dropped: ${dropped.length}${dropped.length ? ` (${dropped.join(", ")})` : ""}`);
  console.log(`  Warnings: ${warnings.length}`);
  for (const w of warnings) console.log(`    - ${w}`);

  if (!opts.validateOnly) {
    const outPath = opts.outputPath ?? join(REPO_ROOT, "dist", "connectors.json");
    if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(`\n[connectors] wrote ${outPath}`);
  }

  return out;
}

// CLI entrypoint
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const validateOnly = process.argv.includes("--validate-only");
  aggregateConnectors({ validateOnly })
    .then((out) => {
      if (!validateOnly && out.entryCount === 0) {
        console.error("ERROR: connectors is empty — refusing to overwrite dist/connectors.json");
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
