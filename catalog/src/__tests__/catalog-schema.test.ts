import { describe, expect, it } from "vitest";
import { CatalogItemSchema, TagSchema } from "../types/catalog.js";

describe("CatalogItemSchema runtimeRequires field", () => {
  const baseItem = {
    id: "skill:test/foo/bar",
    type: "skill" as const,
    name: "Test",
    description: "Test desc",
    version: "1.0.0",
    source: { adapter: "test", url: "https://example.com", locator: "x", commitSha: "abc" },
    trust: { tier: "verified" as const, source: "test" },
    status: "active" as const,
    addedAt: "2026-05-07T00:00:00.000Z",
    category: "engineering" as const,
    tags: [],
  };

  it("accepts items without runtimeRequires (backwards compat)", () => {
    expect(() => CatalogItemSchema.parse(baseItem)).not.toThrow();
  });

  it("accepts string array for runtimeRequires", () => {
    const item = { ...baseItem, runtimeRequires: ["gstack-bin", "gbrain"] };
    const parsed = CatalogItemSchema.parse(item);
    expect(parsed.runtimeRequires).toEqual(["gstack-bin", "gbrain"]);
  });

  it("rejects non-string entries in runtimeRequires", () => {
    const item = { ...baseItem, runtimeRequires: [123] };
    expect(() => CatalogItemSchema.parse(item)).toThrow();
  });
});

describe("TagSchema requires-cli-tooling", () => {
  it("accepts requires-cli-tooling as a valid tag", () => {
    expect(() => TagSchema.parse("requires-cli-tooling")).not.toThrow();
  });

  it("still accepts existing tags", () => {
    expect(() => TagSchema.parse("featured")).not.toThrow();
    expect(() => TagSchema.parse("official")).not.toThrow();
  });
});

describe("CatalogItemSchema skill metadata", () => {
  it("accepts skill bundle and frontmatter metadata", () => {
    const item = {
      id: "skill:github-skills/microsoft/azure-skills/azure-ai",
      type: "skill",
      name: "azure-ai",
      description: "Azure AI guidance",
      version: "1.0.0",
      source: {
        adapter: "github-skills",
        url: "https://github.com/microsoft/azure-skills/tree/abc1234/skills/azure-ai",
        locator: "microsoft/azure-skills/skills/azure-ai",
        commitSha: "catalogsha",
      },
      resourceUrl: "https://raw.githubusercontent.com/microsoft/azure-skills/abc1234/skills/azure-ai/SKILL.md",
      trust: { tier: "verified", source: "github-skills" },
      status: "active",
      addedAt: "2026-05-14T00:00:00.000Z",
      category: "engineering",
      tags: [],
      skill: {
        bundle: {
          type: "github-directory",
          repo: "microsoft/azure-skills",
          commitSha: "abc1234",
          path: "skills/azure-ai",
          treeUrl: "https://github.com/microsoft/azure-skills/tree/abc1234/skills/azure-ai",
        },
        frontmatter: {
          name: "azure-ai",
          description: "Azure AI guidance",
          license: "MIT",
          compatibility: "Requires Azure CLI",
          allowedTools: "shell",
          metadata: { provider: "Microsoft" },
          raw: { license: "MIT", metadata: { provider: "Microsoft" } },
        },
      },
    };

    expect(CatalogItemSchema.shape.skill).toBeDefined();
    expect(() => CatalogItemSchema.parse(item)).not.toThrow();
    expect(CatalogItemSchema.parse(item).skill).toEqual(item.skill);
  });
});
