import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ItemType } from "../../types/catalog.js";
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
  requires: z.array(z.object({
    type: z.custom<ItemType>((value) => ["skill", "plugin", "agent", "team"].includes(String(value))),
    id: z.string().min(1),
    versionRange: z.string().optional(),
  })).optional(),
  contentInline: z.boolean().optional(),
  sourceUrl: z.string().url(),
  license: z.string().optional(),
  featured: z.boolean().optional(),
  runtime: AgentManifestRuntimeSchema,
});

export type AgentContentManifest = z.infer<typeof AgentContentManifestSchema>;

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
    if (!isSafeAgentRelativePath(runtime.instructions.path)) {
      throw new Error(`agent instructions path is unsafe: ${runtime.instructions.path}`);
    }
    const instructionPath = join(itemDir, runtime.instructions.path);
    if (!existsSync(instructionPath)) {
      throw new Error(`agent instructions file not found: ${runtime.instructions.path}`);
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

  return manifest;
}
