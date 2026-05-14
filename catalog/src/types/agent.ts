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

const AgentBundleInstructionsBaseSchema = z.object({
  type: z.literal("bundle"),
  entry: z.string().trim().min(1),
  files: z.array(z.string().trim().min(1)).min(1),
}).strict();

function refineAgentBundleInstructions(
  instructions: z.infer<typeof AgentBundleInstructionsBaseSchema>,
  ctx: z.RefinementCtx,
): void {
  const seenFiles = new Set<string>();

  for (const [index, file] of instructions.files.entries()) {
    if (seenFiles.has(file)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate bundle instruction file",
        path: ["files", index],
      });
      continue;
    }

    seenFiles.add(file);
  }

  if (!seenFiles.has(instructions.entry)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "entry must be included in bundle instruction files",
      path: ["entry"],
    });
  }
}

export const AgentBundleInstructionsSchema = AgentBundleInstructionsBaseSchema.superRefine(
  refineAgentBundleInstructions,
);

export const AgentInstructionsSchema = z.discriminatedUnion("type", [
  AgentInlineInstructionsSchema,
  AgentFileInstructionsSchema,
  AgentBundleInstructionsBaseSchema,
]).superRefine((instructions, ctx) => {
  if (instructions.type === "bundle") {
    refineAgentBundleInstructions(instructions, ctx);
  }
});

export const AgentDependenciesSchema = z.object({
  skills: z.record(AgentRuntimeDependencyAliasSchema, CatalogDependencyIdSchema).optional(),
  plugins: z.record(AgentRuntimeDependencyAliasSchema, CatalogDependencyIdSchema).optional(),
}).strict().optional();

export const AgentAoaAdapterCompatibilitySchema = z.object({
  recommended: z.string().trim().min(1).optional(),
  supported: z.array(z.string().trim().min(1)).min(1).optional(),
  requiresInstructionsBundle: z.boolean().optional(),
  requiresSkillInjection: z.boolean().optional(),
}).strict().superRefine((compatibility, ctx) => {
  if (
    compatibility.recommended !== undefined &&
    compatibility.supported !== undefined &&
    !compatibility.supported.includes(compatibility.recommended)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "recommended adapter must be included in supported adapters",
      path: ["recommended"],
    });
  }
});

export const AgentAoaInstallHintsSchema = z.object({
  defaultRole: z.string().trim().min(1).optional(),
  defaultStatus: z.enum(["active", "paused", "terminated"]).optional(),
  defaultIcon: z.string().trim().min(1).optional(),
}).strict();

export const AgentAoaSetupSecretSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean().optional(),
  reason: z.string().trim().min(1),
  usedBy: z.string().trim().min(1).optional(),
}).strict();

export const AgentAoaSetupPluginConfigSchema = z.object({
  plugin: z.string().trim().min(1),
  required: z.boolean().optional(),
  reason: z.string().trim().min(1),
}).strict();

export const AgentAoaSetupSchema = z.object({
  secrets: z.array(AgentAoaSetupSecretSchema).optional(),
  pluginConfig: z.array(AgentAoaSetupPluginConfigSchema).optional(),
  notes: z.array(z.string().trim().min(1)).optional(),
}).strict();

export const AgentAoaHintsSchema = z.object({
  adapterType: z.string().min(1).optional(),
  adapterCompatibility: AgentAoaAdapterCompatibilitySchema.optional(),
  install: AgentAoaInstallHintsSchema.optional(),
  runtimeConfig: z.record(z.unknown()).optional(),
  adapterConfig: z.record(z.unknown()).optional(),
  permissions: z.record(z.unknown()).optional(),
  skillKeys: z.array(z.string().min(1)).optional(),
  setup: AgentAoaSetupSchema.optional(),
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
