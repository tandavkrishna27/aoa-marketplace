import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  McpConnectorCatalogEntrySchema,
  findSecretValue,
  clampTrustTier,
} from "../types/connector.js";
import { aggregateConnectors } from "../aggregate-connectors.js";

const validStdio = {
  id: "example",
  displayName: "Example",
  serverName: "example",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@example/mcp"],
  requiresSecret: false,
  requiresOAuth: false,
  trust: { tier: "verified" },
};

describe("connector schema", () => {
  it("accepts a valid stdio entry", () => {
    const parsed = McpConnectorCatalogEntrySchema.safeParse(validStdio);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.trust.tier).toBe("verified");
      expect(parsed.data.transport).toBe("stdio");
    }
  });

  it("accepts a valid http entry with an Authorization header key", () => {
    const parsed = McpConnectorCatalogEntrySchema.safeParse({
      id: "linear",
      displayName: "Linear",
      serverName: "linear",
      transport: "http",
      url: "https://mcp.linear.app/mcp",
      headerTemplateKeys: ["Authorization"],
      requiresSecret: true,
      trust: { tier: "verified" },
    });
    expect(parsed.success).toBe(true);
  });

  it("emits an OAuth entry with requiresOAuth:true", () => {
    const parsed = McpConnectorCatalogEntrySchema.safeParse({
      id: "notion-hosted",
      displayName: "Notion (hosted)",
      serverName: "notion-hosted",
      transport: "http",
      url: "https://mcp.notion.com/mcp",
      requiresSecret: false,
      requiresOAuth: true,
      trust: { tier: "verified" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.requiresOAuth).toBe(true);
      expect(parsed.data.requiresSecret).toBe(false);
    }
  });

  it("survives an unknown additive field (forward-compat .strip())", () => {
    const parsed = McpConnectorCatalogEntrySchema.safeParse({
      ...validStdio,
      iconUrl: "https://example.com/icon.png", // future field this schema does not know
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Stripped, not carried through.
      expect((parsed.data as Record<string, unknown>).iconUrl).toBeUndefined();
    }
  });

  it("rejects a header template KEY that smuggles a value (Name: value)", () => {
    const parsed = McpConnectorCatalogEntrySchema.safeParse({
      ...validStdio,
      transport: "http",
      url: "https://example.com/mcp",
      command: undefined,
      args: [],
      headerTemplateKeys: ["Authorization: Bearer sk-secret"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an env template KEY that smuggles a value (NAME=value)", () => {
    const parsed = McpConnectorCatalogEntrySchema.safeParse({
      ...validStdio,
      envTemplateKeys: ["TOKEN=sk-secret"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a bad serverName charset", () => {
    expect(McpConnectorCatalogEntrySchema.safeParse({ ...validStdio, serverName: "Bad_Name" }).success).toBe(false);
    expect(McpConnectorCatalogEntrySchema.safeParse({ ...validStdio, serverName: "has space" }).success).toBe(false);
  });

  it("rejects transport/url/command incoherence", () => {
    // http without url
    expect(
      McpConnectorCatalogEntrySchema.safeParse({ ...validStdio, transport: "http", command: undefined, args: [] })
        .success,
    ).toBe(false);
    // stdio with a url
    expect(
      McpConnectorCatalogEntrySchema.safeParse({ ...validStdio, url: "https://example.com/mcp" }).success,
    ).toBe(false);
    // http that also carries a command
    expect(
      McpConnectorCatalogEntrySchema.safeParse({
        ...validStdio,
        transport: "http",
        url: "https://example.com/mcp",
      }).success,
    ).toBe(false);
  });

  it("rejects requiresOAuth && requiresSecret nonsense", () => {
    expect(
      McpConnectorCatalogEntrySchema.safeParse({
        id: "x",
        displayName: "X",
        serverName: "x",
        transport: "http",
        url: "https://example.com/mcp",
        requiresOAuth: true,
        requiresSecret: true,
        trust: { tier: "community" },
      }).success,
    ).toBe(false);
  });

  it("fails trust closed to community when trust block is absent", () => {
    const parsed = McpConnectorCatalogEntrySchema.safeParse({
      id: "x",
      displayName: "X",
      serverName: "x",
      transport: "stdio",
      command: "npx",
      args: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.trust.tier).toBe("community");
  });
});

describe("findSecretValue", () => {
  it("flags a real credential hard-coded into args", () => {
    expect(findSecretValue({ ...validStdio, args: ["--token", "sk-abc123def456ghi789"] })).not.toBeNull();
    expect(findSecretValue({ ...validStdio, args: ["--pat", "ghp_0123456789abcdefghijABCDEF"] })).not.toBeNull();
  });

  it("flags credentials embedded in a connection-string url/arg", () => {
    expect(
      findSecretValue({ ...validStdio, args: ["postgresql://user:hunter2@db.example.com:5432/app"] }),
    ).not.toBeNull();
  });

  it("does NOT flag the sanctioned ${TOKEN} placeholder", () => {
    expect(findSecretValue({ ...validStdio, args: ["-y", "@modelcontextprotocol/server-postgres", "${TOKEN}"] })).toBeNull();
  });

  it("does NOT flag a clean stdio entry", () => {
    expect(findSecretValue(validStdio)).toBeNull();
  });
});

describe("clampTrustTier", () => {
  it("keeps a declared tier at or below the ceiling", () => {
    expect(clampTrustTier("verified", "verified")).toBe("verified");
    expect(clampTrustTier("community", "verified")).toBe("community");
    expect(clampTrustTier("unverified", "verified")).toBe("unverified");
  });

  it("clamps a declared tier that exceeds the ceiling (no self-promotion)", () => {
    expect(clampTrustTier("verified", "community")).toBe("community");
    expect(clampTrustTier("community", "unverified")).toBe("unverified");
  });
});

describe("aggregateConnectors (integration against real curated content)", () => {
  it("produces a valid connectors.json envelope with the curated entries", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "connectors-agg-"));
    try {
      const out = await aggregateConnectors({ validateOnly: false, outputPath: join(tmp, "connectors.json") });

      expect(out.schemaVersion).toBe("1.0.0");
      expect(out.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(out.entryCount).toBe(out.entries.length);
      expect(out.entryCount).toBeGreaterThanOrEqual(14);

      // Every emitted entry re-validates against the schema.
      for (const e of out.entries) {
        expect(McpConnectorCatalogEntrySchema.safeParse(e).success, `entry ${e.id} invalid`).toBe(true);
        expect(findSecretValue(e), `entry ${e.id} leaks a secret`).toBeNull();
      }

      const byId = new Map(out.entries.map((e) => [e.id, e]));

      // A known-good local stdio entry aggregates as verified.
      expect(byId.get("filesystem")?.trust.tier).toBe("verified");
      expect(byId.get("filesystem")?.transport).toBe("stdio");

      // The proven token stdio entry is verified and declares its env key only.
      expect(byId.get("notion-local")?.trust.tier).toBe("verified");
      expect(byId.get("notion-local")?.envTemplateKeys).toContain("NOTION_TOKEN");
      expect(byId.get("notion-local")?.requiresSecret).toBe(true);

      // The OAuth-only entry is emitted with requiresOAuth:true, no secret slot.
      const notionHosted = byId.get("notion-hosted");
      expect(notionHosted?.requiresOAuth).toBe(true);
      expect(notionHosted?.requiresSecret).toBe(false);
      expect(notionHosted?.headerTemplateKeys).toEqual([]);

      // Sentry ships via its OAuth path (non-standard scheme inexpressible).
      expect(byId.get("sentry")?.requiresOAuth).toBe(true);

      // HTTP token entry carries the Authorization header NAME only.
      expect(byId.get("linear")?.headerTemplateKeys).toEqual(["Authorization"]);
      expect(byId.get("linear")?.requiresSecret).toBe(true);
      expect(byId.get("linear")?.requiresOAuth).toBe(false);

      // Entries are sorted by id.
      const ids = out.entries.map((e) => e.id);
      expect([...ids].sort()).toEqual(ids);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
