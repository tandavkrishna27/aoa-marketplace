import { describe, expect, it } from "vitest";
import { githubSkillsAdapter } from "../adapter.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function silentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

describe("githubSkillsAdapter shape", () => {
  it("has correct id", () => {
    expect(githubSkillsAdapter.id).toBe("github-skills");
  });

  it("has displayName", () => {
    expect(githubSkillsAdapter.displayName).toBe("GitHub Skills");
  });

  it("has community as default trust tier", () => {
    expect(githubSkillsAdapter.defaultTrustTier).toBe("community");
  });

  it("conforms to SourceAdapter interface", () => {
    expect(typeof githubSkillsAdapter.fetch).toBe("function");
    expect(typeof githubSkillsAdapter.normalize).toBe("function");
  });
});

describe("githubSkillsAdapter.fetch sources enumeration", () => {
  it("returns an empty list when trusted-sources.json has no github-skills entries", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-"));
    try {
      writeFileSync(
        join(tmp, "trusted-sources.json"),
        JSON.stringify({ schemaVersion: "1.0.0", trustedSources: [] }),
      );
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = (await githubSkillsAdapter.fetch(ctx)) as { sources: unknown[] };
      expect(raw.sources).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });

  it("filters to github-skills entries only", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "ghs-"));
    try {
      writeFileSync(
        join(tmp, "trusted-sources.json"),
        JSON.stringify({
          schemaVersion: "1.0.0",
          trustedSources: [
            { adapter: "aoa-curated", tier: "verified", reason: "x" },
            {
              adapter: "github-skills",
              tier: "verified",
              reason: "gstack",
              config: { repo: "garrytan/gstack", ref: "main" },
            },
          ],
        }),
      );
      const ctx = { workDir: tmp, logger: silentLogger(), commitSha: "deadbeef" };
      const raw = (await githubSkillsAdapter.fetch(ctx)) as { sources: Array<{ config: { repo: string } }> };
      expect(raw.sources).toHaveLength(1);
      expect(raw.sources[0].config.repo).toBe("garrytan/gstack");
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });
});
