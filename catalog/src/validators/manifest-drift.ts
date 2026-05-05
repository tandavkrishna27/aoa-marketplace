import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface DriftCheckResult {
  pluginId: string;
  inSrcOnly: string[];   // present in compiled src, absent from manifest.json → CI failure
  inJsonOnly: string[];  // present in manifest.json, absent from src → warning only (stale)
  skipped: boolean;      // true when dist/manifest.js not found (build not run)
}

/**
 * Parse the capabilities array from a compiled dist/manifest.js without importing it.
 *
 * This avoids Vite/Vitest's module graph interception and works even when the
 * dist file has relative imports (e.g. `import ... from "./constants.js"`) that
 * would fail in an ESM-only context outside the original package.
 *
 * Strategy: the compiled output always contains a literal capabilities array.
 * We extract the block between `capabilities: [` and the matching `]` and parse
 * the quoted strings out of it.
 */
function parseCapabilitiesFromDistJs(filePath: string): string[] {
  const src = readFileSync(filePath, "utf-8");

  // Match the capabilities array literal: `capabilities: [` ... `]`
  // We use a simple bracket-depth scan to handle multi-line arrays.
  const startIdx = src.indexOf("capabilities:");
  if (startIdx === -1) return [];

  const bracketOpen = src.indexOf("[", startIdx);
  if (bracketOpen === -1) return [];

  let depth = 0;
  let end = -1;
  for (let i = bracketOpen; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];

  const arrayText = src.slice(bracketOpen, end + 1);

  // Extract all quoted strings from the array literal.
  const caps: string[] = [];
  const stringRe = /["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = stringRe.exec(arrayText)) !== null) {
    caps.push(match[1]);
  }
  return caps;
}

export async function checkManifestDrift(
  pluginDir: string,
  manifestJsonCaps: string[],
  pluginId: string,
): Promise<DriftCheckResult> {
  const distManifestPath = join(pluginDir, "dist", "manifest.js");

  if (!existsSync(distManifestPath)) {
    return { pluginId, inSrcOnly: [], inJsonOnly: [], skipped: true };
  }

  const srcCaps = parseCapabilitiesFromDistJs(distManifestPath);

  const jsonSet = new Set(manifestJsonCaps);
  const srcSet = new Set(srcCaps);

  return {
    pluginId,
    inSrcOnly: srcCaps.filter((c) => !jsonSet.has(c)),
    inJsonOnly: manifestJsonCaps.filter((c) => !srcSet.has(c)),
    skipped: false,
  };
}
