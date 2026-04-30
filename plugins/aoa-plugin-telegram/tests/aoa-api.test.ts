import { describe, expect, it, vi, afterEach } from "vitest";
import type { PluginContext } from "@armyofagents/plugin-sdk";
import { buildAoaAuthHeaders, fetchAoaApi } from "../src/AoA-api.js";

function mockCtx() {
  return {
    http: {
      fetch: vi.fn(async () => new Response("{}")),
    },
  } as unknown as PluginContext;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAoaApi", () => {
  it("uses native fetch for loopback AoA URLs", async () => {
    const ctx = mockCtx();
    const nativeFetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", nativeFetch);

    await fetchAoaApi(ctx, "http://127.0.0.1:3101/api/approvals/apr-1/approve", {
      method: "POST",
    });

    expect(nativeFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3101/api/approvals/apr-1/approve",
      { method: "POST" },
    );
    expect(ctx.http.fetch).not.toHaveBeenCalled();
  });

  it("keeps using host fetch for non-loopback URLs", async () => {
    const ctx = mockCtx();
    const nativeFetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", nativeFetch);

    await fetchAoaApi(ctx, "https://aoa.example.com/api/approvals/apr-1/approve", {
      method: "POST",
    });

    expect(ctx.http.fetch).toHaveBeenCalledWith(
      "https://aoa.example.com/api/approvals/apr-1/approve",
      { method: "POST" },
    );
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it("throws when AoA returns a non-2xx response", async () => {
    const ctx = mockCtx();
    const nativeFetch = vi.fn(async () => new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    }));
    vi.stubGlobal("fetch", nativeFetch);

    await expect(
      fetchAoaApi(ctx, "http://127.0.0.1:3101/api/approvals/apr-1/approve", {
        method: "POST",
      }),
    ).rejects.toThrow("AoA API request failed with 403");
  });

  it("builds authorization headers when a board API token is configured", () => {
    expect(buildAoaAuthHeaders("aoa_board_token")).toEqual({
      Authorization: "Bearer aoa_board_token",
    });
    expect(buildAoaAuthHeaders()).toEqual({});
  });
});
