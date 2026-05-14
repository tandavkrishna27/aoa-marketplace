import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAndValidateAgentContent } from "../agent-content.js";

const manifest = {
  id: "agent:aoa-curated/test-agent",
  name: "Test Agent",
  description: "Test marketplace agent fixture.",
  version: "1.0.0",
  category: "engineering",
  tags: ["official"],
  sourceUrl: "https://github.com/MeteoriteLabs/aoa-marketplace",
  runtime: { entry: "agent.json" },
  requires: [
    { type: "skill", id: "skill:github-skills/openai/skills/openai-docs" },
  ],
};

const agent = {
  schemaVersion: "agent.v1",
  id: "test-agent",
  name: "Test Agent",
  description: "Test marketplace agent fixture.",
  instructions: { type: "inline", content: "Triage issues." },
};

const tempDirs: string[] = [];

function makeItemDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-content-"));
  tempDirs.push(dir);
  writeJson(dir, "manifest.json", manifest);
  writeJson(dir, "agent.json", agent);
  return dir;
}

function writeJson(dir: string, filename: string, value: unknown): void {
  writeFileSync(join(dir, filename), `${JSON.stringify(value, null, 2)}\n`);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadAndValidateAgentContent", () => {
  it("throws when agent.json is missing", () => {
    const dir = makeItemDir();
    rmSync(join(dir, "agent.json"));

    expect(() => loadAndValidateAgentContent(dir)).toThrow(/agent\.json is required/);
  });

  it("throws when agent.json uses an unsupported schemaVersion", () => {
    const dir = makeItemDir();
    writeJson(dir, "agent.json", { ...agent, schemaVersion: "agent.v2" });

    expect(() => loadAndValidateAgentContent(dir)).toThrow();
  });

  it("throws when file instructions are missing", () => {
    const dir = makeItemDir();
    writeJson(dir, "agent.json", {
      ...agent,
      instructions: { type: "file", path: "instructions.md" },
    });

    expect(() => loadAndValidateAgentContent(dir)).toThrow(/instructions file not found/);
  });

  it("throws when file instructions point to a directory", () => {
    const dir = makeItemDir();
    mkdirSync(join(dir, "instructions.md"));
    writeJson(dir, "agent.json", {
      ...agent,
      instructions: { type: "file", path: "instructions.md" },
    });

    expect(() => loadAndValidateAgentContent(dir)).toThrow(/instructions path is not a file/);
  });

  it("throws when file instructions resolve outside the agent directory", () => {
    const dir = makeItemDir();
    const externalDir = mkdtempSync(join(tmpdir(), "agent-content-external-"));
    tempDirs.push(externalDir);
    symlinkSync(externalDir, join(dir, "instructions.md"), "junction");
    writeJson(dir, "agent.json", {
      ...agent,
      instructions: { type: "file", path: "instructions.md" },
    });

    expect(() => loadAndValidateAgentContent(dir)).toThrow(/instructions path escapes agent directory/);
  });

  it("allows safe paths that start with two dots but remain inside the agent directory", () => {
    const dir = makeItemDir();
    mkdirSync(join(dir, "..safe"));
    writeFileSync(join(dir, "..safe", "instructions.md"), "Use the safe local file.\n");
    writeJson(dir, "agent.json", {
      ...agent,
      instructions: { type: "file", path: "..safe/instructions.md" },
    });

    expect(loadAndValidateAgentContent(dir).id).toBe("agent:aoa-curated/test-agent");
  });

  it("throws when the instruction path is unsafe", () => {
    const dir = makeItemDir();
    writeJson(dir, "agent.json", {
      ...agent,
      instructions: { type: "file", path: "../instructions.md" },
    });

    expect(() => loadAndValidateAgentContent(dir)).toThrow(/instructions path is unsafe/);
  });

  it("throws when a runtime skill dependency is not declared in manifest.requires", () => {
    const dir = makeItemDir();
    writeJson(dir, "agent.json", {
      ...agent,
      dependencies: {
        skills: {
          auth0: "skill:github-skills/auth0/skills/auth0",
        },
      },
    });

    expect(() => loadAndValidateAgentContent(dir)).toThrow(/must be declared in manifest\.requires as type skill/);
  });

  it("throws when a runtime plugin dependency is not declared in manifest.requires as a plugin", () => {
    const dir = makeItemDir();
    writeJson(dir, "manifest.json", { ...manifest, requires: [] });
    writeJson(dir, "agent.json", {
      ...agent,
      dependencies: {
        plugins: {
          githubIssues: "plugin:aoa-curated/aoa-plugin-github-issues",
        },
      },
    });

    expect(() => loadAndValidateAgentContent(dir)).toThrow(/must be declared in manifest\.requires as type plugin/);
  });
});
