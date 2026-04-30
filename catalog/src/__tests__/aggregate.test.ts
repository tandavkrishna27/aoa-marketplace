import { describe, it, expect } from "vitest";
import { aggregate } from "../aggregate.js";

describe("aggregate", () => {
  // Integration test: runs the full pipeline against the real monorepo + (optionally) network.
  // - With network: anthropic-skills adapter clones successfully, returns N items.
  // - Without network: anthropic-skills fails inside aggregate's try/catch, returns 0 items.
  // Either way, validateOnly: true skips writing dist/catalog.json.
  it("runs end-to-end without crashing", async () => {
    const catalog = await aggregate({ validateOnly: true });
    expect(catalog.schemaVersion).toBe("1.0.0");
    expect(catalog.itemCount).toBeGreaterThanOrEqual(0);
    expect(catalog.items.every((i) => i.id.length > 0)).toBe(true);
    expect(catalog.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, { timeout: 60_000 });
});
