import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSkillOverrides, mergeRuntimeRequires } from "../overrides.js";

describe("loadSkillOverrides", () => {
  it("returns empty map when file missing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "ovr-"));
    try {
      const result = loadSkillOverrides(tmp);
      expect(result.size).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });

  it("loads a JSON file with id→string-array mapping", () => {
    const tmp = mkdtempSync(join(tmpdir(), "ovr-"));
    try {
      writeFileSync(
        join(tmp, "skill-overrides.json"),
        JSON.stringify({
          "skill:github-skills/garrytan/gstack/browse": ["gstack-bin", "gstack-browse-daemon"],
          "skill:github-skills/garrytan/gstack/learn": ["gbrain"],
        }),
      );
      const result = loadSkillOverrides(tmp);
      expect(result.get("skill:github-skills/garrytan/gstack/browse")).toEqual([
        "gstack-bin",
        "gstack-browse-daemon",
      ]);
      expect(result.size).toBe(2);
    } finally {
      rmSync(tmp, { recursive: true });
    }
  });
});

describe("mergeRuntimeRequires", () => {
  it("returns frontmatter value when present (precedence)", () => {
    const overrides = new Map([["skill:foo/bar", ["override"]]]);
    expect(mergeRuntimeRequires(["frontmatter"], "skill:foo/bar", overrides)).toEqual(["frontmatter"]);
  });

  it("returns override when frontmatter is undefined", () => {
    const overrides = new Map([["skill:foo/bar", ["override-val"]]]);
    expect(mergeRuntimeRequires(undefined, "skill:foo/bar", overrides)).toEqual(["override-val"]);
  });

  it("returns empty array when neither has a value", () => {
    expect(mergeRuntimeRequires(undefined, "skill:foo/bar", new Map())).toEqual([]);
  });
});
