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
