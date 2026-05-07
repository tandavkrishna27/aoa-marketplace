import { describe, expect, it } from "vitest";
import { githubSkillsAdapter } from "../adapter.js";

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
