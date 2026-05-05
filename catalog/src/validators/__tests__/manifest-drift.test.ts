import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkManifestDrift } from "../manifest-drift.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Use the real slack plugin as a fixture — after pnpm build it has dist/manifest.js
const SLACK_PLUGIN_DIR = join(__dirname, "../../../../plugins/aoa-plugin-slack");

describe("checkManifestDrift", () => {
  it("returns skipped=true when dist/manifest.js does not exist", async () => {
    const result = await checkManifestDrift(
      "/nonexistent/path",
      ["http.outbound"],
      "test-plugin",
    );
    expect(result.skipped).toBe(true);
    expect(result.inSrcOnly).toHaveLength(0);
    expect(result.inJsonOnly).toHaveLength(0);
  });

  it("detects caps in src but missing from manifest.json", async () => {
    // Simulate: manifest.json has only 1 cap; src has 20
    const result = await checkManifestDrift(
      SLACK_PLUGIN_DIR,
      ["http.outbound"],         // manifest.json subset — only 1 of 20 caps
      "aoa.plugin-slack",
    );
    // After M1 fix, src/manifest.ts has 20 caps.
    // Only "http.outbound" is in our fake json, so inSrcOnly must be non-empty.
    if (!result.skipped) {
      expect(result.inSrcOnly.length).toBeGreaterThan(0);
      expect(result.inSrcOnly).not.toContain("http.outbound");
    }
  });

  it("detects no drift when manifest.json matches src", async () => {
    // Read the real manifest.json caps (which now have 20 after M1 fix)
    const { readFileSync } = await import("node:fs");
    const raw = JSON.parse(readFileSync(join(SLACK_PLUGIN_DIR, "manifest.json"), "utf-8")) as {
      capabilities: string[];
    };
    const result = await checkManifestDrift(
      SLACK_PLUGIN_DIR,
      raw.capabilities,
      "aoa.plugin-slack",
    );
    if (!result.skipped) {
      expect(result.inSrcOnly).toHaveLength(0);
    }
  });
});
