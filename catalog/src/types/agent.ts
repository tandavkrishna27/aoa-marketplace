import { z } from "zod";

export const AGENT_RUNTIME_SCHEMA_VERSION = "agent.v1" as const;

export const AgentRuntimeDependencyAliasSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "alias must start with a letter and contain only letters, numbers, or underscores");

const CatalogDependencyIdSchema = z.string().min(1);

export const AgentInlineInstructionsSchema = z.object({
  type: z.literal("inline"),
  content: z.string().trim().min(1),
}).strict();

export const AgentFileInstructionsSchema = z.object({
  type: z.literal("file"),
  path: z.string().trim().min(1),
}).strict();

export const AgentInstructionsSchema = z.discriminatedUnion("type", [
  AgentInlineInstructionsSchema,
  AgentFileInstructionsSchema,
]);

export const AgentDependenciesSchema = z.object({
  skills: z.record(AgentRuntimeDependencyAliasSchema, CatalogDependencyIdSchema).optional(),
  plugins: z.record(AgentRuntimeDependencyAliasSchema, CatalogDependencyIdSchema).optional(),
}).strict().optional();

export const AgentAoaHintsSchema = z.object({
  adapterType: z.string().min(1).optional(),
  runtimeConfig: z.record(z.unknown()).optional(),
  adapterConfig: z.record(z.unknown()).optional(),
  permissions: z.record(z.unknown()).optional(),
  skillKeys: z.array(z.string().min(1)).optional(),
}).strict().optional();

export const AgentRuntimeSchema = z.object({
  schemaVersion: z.literal(AGENT_RUNTIME_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  instructions: AgentInstructionsSchema,
  dependencies: AgentDependenciesSchema,
  aoa: AgentAoaHintsSchema,
}).strict();

export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

export function isSafeAgentRelativePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.length === 0) return false;
  if (normalized.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(normalized)) return false;
  if (normalized.includes("\0")) return false;
  return normalized.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function collectAgentRuntimeDependencyIds(runtime: AgentRuntime): {
  skills: string[];
  plugins: string[];
} {
  return {
    skills: Object.values(runtime.dependencies?.skills ?? {}),
    plugins: Object.values(runtime.dependencies?.plugins ?? {}),
  };
}
