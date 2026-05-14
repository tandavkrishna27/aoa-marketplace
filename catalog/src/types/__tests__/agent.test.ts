import { describe, expect, it } from "vitest";
import {
  AgentRuntimeSchema,
  AgentRuntimeDependencyAliasSchema,
  isSafeAgentRelativePath,
} from "../agent.js";

describe("AgentRuntimeSchema", () => {
  it("accepts an agent.v1 runtime with multiple skill and plugin aliases", () => {
    const parsed = AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "issue-triager",
      name: "Issue Triager",
      description: "Triages issues and proposes next actions.",
      instructions: { type: "file", path: "instructions.md" },
      dependencies: {
        skills: {
          openaiDocs: "skill:github-skills/openai/skills/openai-docs",
          auth0: "skill:github-skills/auth0/skills/auth0",
        },
        plugins: {
          githubIssues: "plugin:aoa-curated/aoa-plugin-github-issues",
          slack: "plugin:aoa-curated/aoa-plugin-slack",
        },
      },
      aoa: {
        adapterType: "codex_local",
        runtimeConfig: {},
        adapterConfig: {},
        permissions: {},
        skillKeys: ["skill:github-skills/openai/skills/openai-docs"],
      },
    });

    expect(parsed.schemaVersion).toBe("agent.v1");
    expect(parsed.dependencies?.skills?.openaiDocs).toContain("openai-docs");
    expect(parsed.dependencies?.plugins?.githubIssues).toContain("github-issues");
  });

  it("accepts inline instructions with non-empty content", () => {
    const parsed = AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "inline-agent",
      name: "Inline Agent",
      description: "Uses inline instructions.",
      instructions: { type: "inline", content: "You triage issues." },
    });

    expect(parsed.instructions.type).toBe("inline");
  });

  it("accepts bundle instructions with entry and multiple files", () => {
    const parsed = AgentRuntimeSchema.parse({
      schemaVersion: "agent.v1",
      id: "bundle-agent",
      name: "Bundle Agent",
      description: "Uses bundled instruction files.",
      instructions: {
        type: "bundle",
        entry: "instructions/main.md",
        files: ["instructions/main.md", "instructions/context.md"],
      },
    });

    expect(parsed.instructions.type).toBe("bundle");
  });

  it("rejects bundle instructions when entry is not listed in files", () => {
    expect(() =>
      AgentRuntimeSchema.parse({
        schemaVersion: "agent.v1",
        id: "missing-entry-agent",
        name: "Missing Entry Agent",
        description: "Has a bundle entry not listed in files.",
        instructions: {
          type: "bundle",
          entry: "instructions/main.md",
          files: ["instructions/context.md"],
        },
      }),
    ).toThrow(/entry must be included/);
  });

  it("rejects duplicate bundle instruction files", () => {
    expect(() =>
      AgentRuntimeSchema.parse({
        schemaVersion: "agent.v1",
        id: "duplicate-files-agent",
        name: "Duplicate Files Agent",
        description: "Has duplicate bundle instruction files.",
        instructions: {
          type: "bundle",
          entry: "instructions/main.md",
          files: ["instructions/main.md", "instructions/main.md"],
        },
      }),
    ).toThrow(/duplicate/);
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      AgentRuntimeSchema.parse({
        schemaVersion: "agent.v2",
        id: "future-agent",
        name: "Future Agent",
        description: "Uses a future schema.",
        instructions: { type: "inline", content: "Hello." },
      }),
    ).toThrow();
  });

  it("rejects invalid dependency alias names", () => {
    expect(() => AgentRuntimeDependencyAliasSchema.parse("github-issues")).toThrow();
    expect(() => AgentRuntimeDependencyAliasSchema.parse("1githubIssues")).toThrow();
    expect(AgentRuntimeDependencyAliasSchema.parse("githubIssues")).toBe("githubIssues");
  });

  it("rejects unknown nested runtime fields", () => {
    expect(() =>
      AgentRuntimeSchema.parse({
        schemaVersion: "agent.v1",
        id: "extra-instructions",
        name: "Extra Instructions",
        description: "Has an unsupported instruction field.",
        instructions: { type: "inline", content: "Hello.", format: "markdown" },
      }),
    ).toThrow();

    expect(() =>
      AgentRuntimeSchema.parse({
        schemaVersion: "agent.v1",
        id: "extra-dependencies",
        name: "Extra Dependencies",
        description: "Has an unsupported dependency group.",
        instructions: { type: "inline", content: "Hello." },
        dependencies: {
          skills: {},
          tools: { shell: "tool:shell" },
        },
      }),
    ).toThrow();
  });

  it("validates safe relative instruction paths", () => {
    expect(isSafeAgentRelativePath("instructions.md")).toBe(true);
    expect(isSafeAgentRelativePath("docs/instructions.md")).toBe(true);
    expect(isSafeAgentRelativePath("../instructions.md")).toBe(false);
    expect(isSafeAgentRelativePath("/tmp/instructions.md")).toBe(false);
    expect(isSafeAgentRelativePath("C:/tmp/instructions.md")).toBe(false);
    expect(isSafeAgentRelativePath("docs//instructions.md")).toBe(false);
  });
});
