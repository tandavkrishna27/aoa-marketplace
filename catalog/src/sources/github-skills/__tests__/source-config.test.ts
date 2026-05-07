import { describe, expect, it } from "vitest";
import { GithubSkillsSourceConfigSchema } from "../source-config.js";

describe("GithubSkillsSourceConfigSchema", () => {
  it("accepts minimal valid config", () => {
    const config = { repo: "garrytan/gstack", ref: "main" };
    expect(() => GithubSkillsSourceConfigSchema.parse(config)).not.toThrow();
  });

  it("accepts config with all optional fields", () => {
    const config = {
      repo: "obra/superpowers",
      ref: "main",
      skillsPath: "skills",
      ignore: ["**/.factory/**"],
      defaultCategory: "engineering",
    };
    expect(() => GithubSkillsSourceConfigSchema.parse(config)).not.toThrow();
  });

  it("rejects repo without owner/name format", () => {
    const config = { repo: "no-slash", ref: "main" };
    expect(() => GithubSkillsSourceConfigSchema.parse(config)).toThrow(/owner\/repo/);
  });

  it("rejects missing ref", () => {
    const config = { repo: "owner/repo" };
    expect(() => GithubSkillsSourceConfigSchema.parse(config)).toThrow();
  });
});
