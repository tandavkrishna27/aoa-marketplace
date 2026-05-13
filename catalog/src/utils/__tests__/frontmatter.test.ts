import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses name/description/version from valid frontmatter", () => {
    const md = `---
name: test-skill
description: A test skill
version: 1.2.3
---

Body here.`;
    const result = parseFrontmatter(md, "fallback");
    expect(result.name).toBe("test-skill");
    expect(result.description).toBe("A test skill");
    expect(result.version).toBe("1.2.3");
  });

  it("falls back to fallbackName when no frontmatter present", () => {
    const md = "Just markdown body, no frontmatter.";
    const result = parseFrontmatter(md, "fallback");
    expect(result.name).toBe("fallback");
    expect(result.description).toBe("fallback");
    expect(result.version).toBe("1.0.0");
  });

  it("strips quotes from values", () => {
    const md = `---
name: "quoted-name"
description: 'single-quoted'
---`;
    const result = parseFrontmatter(md, "fb");
    expect(result.name).toBe("quoted-name");
    expect(result.description).toBe("single-quoted");
  });

  it("handles CRLF line endings", () => {
    const md = "---\r\nname: crlf-name\r\ndescription: x\r\n---\r\nBody";
    const result = parseFrontmatter(md, "fb");
    expect(result.name).toBe("crlf-name");
  });

  it("uses fallback for missing description field", () => {
    const md = `---
name: only-name
---`;
    const result = parseFrontmatter(md, "fallback-desc");
    expect(result.description).toBe("fallback-desc");
  });
});

describe("parseFrontmatter optional fields", () => {
  it("parses category as a string field", () => {
    const md = `---
name: x
description: y
category: engineering
---`;
    expect(parseFrontmatter(md, "fb").category).toBe("engineering");
  });

  it("parses tags as a YAML inline list", () => {
    const md = `---
name: x
description: y
tags: [featured, new]
---`;
    expect(parseFrontmatter(md, "fb").tags).toEqual(["featured", "new"]);
  });

  it("parses runtimeRequires as a YAML inline list", () => {
    const md = `---
name: x
description: y
runtimeRequires: [gstack-bin, gbrain]
---`;
    expect(parseFrontmatter(md, "fb").runtimeRequires).toEqual(["gstack-bin", "gbrain"]);
  });

  it("returns undefined for missing optional fields", () => {
    const md = `---
name: x
description: y
---`;
    const result = parseFrontmatter(md, "fb");
    expect(result.category).toBeUndefined();
    expect(result.tags).toBeUndefined();
    expect(result.runtimeRequires).toBeUndefined();
  });

  it("parses standard skill frontmatter fields", () => {
    const content = `---
name: azure-ai
description: Azure AI guidance
version: 1.2.3
license: MIT
compatibility: Requires Azure CLI
allowed-tools: shell web
user-invocable: true
disable-model-invocation: false
metadata:
  provider: Microsoft
  product: Azure
---

# Azure AI
`;

    const parsed = parseFrontmatter(content, "fallback");

    expect(parsed.name).toBe("azure-ai");
    expect(parsed.description).toBe("Azure AI guidance");
    expect(parsed.version).toBe("1.2.3");
    expect(parsed.license).toBe("MIT");
    expect(parsed.compatibility).toBe("Requires Azure CLI");
    expect(parsed.allowedTools).toBe("shell web");
    expect(parsed.userInvocable).toBe(true);
    expect(parsed.disableModelInvocation).toBe(false);
    expect(parsed.metadata).toEqual({ provider: "Microsoft", product: "Azure" });
    expect(parsed.raw["allowed-tools"]).toBe("shell web");
  });

  it("preserves unknown scalar frontmatter fields in raw", () => {
    const content = `---
name: custom
description: Custom skill
x-provider-slug: provider-x
---

Body.
`;

    const parsed = parseFrontmatter(content, "fallback");

    expect(parsed.raw["x-provider-slug"]).toBe("provider-x");
  });

  it("preserves block list values in raw and maps allowed-tools lists", () => {
    const content = `---
name: list-tools
description: Uses list-style allowed tools
allowed-tools:
  - Bash
  - Read
x-extra-list:
  - first
  - second
---

Body.
`;

    const parsed = parseFrontmatter(content, "fallback");

    expect(parsed.raw["allowed-tools"]).toEqual(["Bash", "Read"]);
    expect(parsed.allowedTools).toContain("Bash");
    expect(parsed.allowedTools).toContain("Read");
    expect(parsed.raw["x-extra-list"]).toEqual(["first", "second"]);
  });
});
