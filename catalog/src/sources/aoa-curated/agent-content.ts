import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { z } from "zod";
import { RequiresSchema } from "../../types/catalog.js";
import {
  AgentRuntimeSchema,
  collectAgentRuntimeDependencyIds,
  isSafeAgentRelativePath,
} from "../../types/agent.js";

const AgentManifestRuntimeSchema = z.object({
  entry: z.literal("agent.json"),
});

export const AgentContentManifestSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  capabilities: z.array(z.object({ id: z.string().min(1), description: z.string().min(1) })).optional(),
  requires: z.array(RequiresSchema).optional(),
  contentInline: z.boolean().optional(),
  sourceUrl: z.string().url(),
  license: z.string().optional(),
  featured: z.boolean().optional(),
  runtime: AgentManifestRuntimeSchema,
});

export type AgentContentManifest = z.infer<typeof AgentContentManifestSchema>;

function assertAgentInstructionFile(itemDir: string, relativePath: string): void {
  if (!isSafeAgentRelativePath(relativePath)) {
    throw new Error(`agent instructions path is unsafe: ${relativePath}`);
  }
  const instructionPath = join(itemDir, relativePath);
  if (!existsSync(instructionPath)) {
    throw new Error(`agent instructions file not found: ${relativePath}`);
  }
  const realItemDir = realpathSync(itemDir);
  const realInstructionPath = realpathSync(instructionPath);
  const relativeToAgent = relative(realItemDir, realInstructionPath);
  if (
    relativeToAgent === "" ||
    relativeToAgent === ".." ||
    relativeToAgent.startsWith(`..${sep}`) ||
    isAbsolute(relativeToAgent) ||
    relativeToAgent.includes("\0")
  ) {
    throw new Error(`agent instructions path escapes agent directory: ${relativePath}`);
  }
  if (!statSync(instructionPath).isFile()) {
    throw new Error(`agent instructions path is not a file: ${relativePath}`);
  }
}

export function loadAndValidateAgentContent(itemDir: string): AgentContentManifest {
  const manifestPath = join(itemDir, "manifest.json");
  const agentPath = join(itemDir, "agent.json");
  if (!existsSync(agentPath)) {
    throw new Error("agent runtime file agent.json is required");
  }

  const manifest = AgentContentManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, "utf-8")),
  );
  const runtime = AgentRuntimeSchema.parse(
    JSON.parse(readFileSync(agentPath, "utf-8")),
  );

  if (runtime.instructions.type === "file") {
    assertAgentInstructionFile(itemDir, runtime.instructions.path);
  } else if (runtime.instructions.type === "bundle") {
    for (const file of runtime.instructions.files) {
      assertAgentInstructionFile(itemDir, file);
    }
  }

  const requiresById = new Map((manifest.requires ?? []).map((req) => [req.id, req.type]));
  const runtimeDeps = collectAgentRuntimeDependencyIds(runtime);
  for (const id of runtimeDeps.skills) {
    if (requiresById.get(id) !== "skill") {
      throw new Error(`agent runtime skill dependency ${id} must be declared in manifest.requires as type skill`);
    }
  }
  for (const id of runtimeDeps.plugins) {
    if (requiresById.get(id) !== "plugin") {
      throw new Error(`agent runtime plugin dependency ${id} must be declared in manifest.requires as type plugin`);
    }
  }
  for (const id of runtime.aoa?.skillKeys ?? []) {
    if (requiresById.get(id) !== "skill") {
      throw new Error(`agent AoA skill key ${id} must be declared in manifest.requires as type skill`);
    }
  }
  for (const setup of runtime.aoa?.setup?.pluginConfig ?? []) {
    if (requiresById.get(setup.plugin) !== "plugin") {
      throw new Error(`agent AoA setup plugin ${setup.plugin} must be declared in manifest.requires as type plugin`);
    }
  }

  return manifest;
}
