import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogItem } from "../types/catalog.js";

export const DEFAULT_CREW_TEAM_ID = "team:aoa-curated/default-crew";
export const STEWARD_AGENT_ID = "agent:aoa-curated/aoa-steward";
const STEWARD_INSTALL_ORDER_SLUG = "steward";

interface DefaultCrewSource {
  stewardManifest: unknown;
  teamManifest: unknown;
  teamBody: unknown;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Validate all source representations that must move together when the
 * protected default crew changes.
 */
export function validateDefaultCrewSource(source: DefaultCrewSource): string[] {
  const failures: string[] = [];
  const stewardManifest = record(source.stewardManifest);
  const teamManifest = record(source.teamManifest);
  const teamBody = record(source.teamBody);

  if (stewardManifest?.id !== STEWARD_AGENT_ID) {
    failures.push(`Steward manifest id must be ${STEWARD_AGENT_ID}`);
  }
  if (teamManifest?.id !== DEFAULT_CREW_TEAM_ID) {
    failures.push(`default-crew manifest id must be ${DEFAULT_CREW_TEAM_ID}`);
  }

  const stewardRequirements = array(teamManifest?.requires)
    .map(record)
    .filter((requirement) => requirement?.id === STEWARD_AGENT_ID);
  if (stewardRequirements.length !== 1) {
    failures.push("default-crew manifest must require Steward exactly once");
  } else if (stewardRequirements[0]?.type !== "agent") {
    failures.push("default-crew Steward requirement must be an agent dependency");
  }

  const stewardMembers = array(teamBody?.agents)
    .map(record)
    .filter((member) => member?.templateOrigin === STEWARD_AGENT_ID);
  if (stewardMembers.length !== 1) {
    failures.push("default-crew team body must contain Steward exactly once");
  }

  const teamRuntimeManifest = record(teamBody?.manifest);
  const stewardInstallOrderEntries = array(teamRuntimeManifest?.installOrder)
    .filter((entry) => entry === STEWARD_INSTALL_ORDER_SLUG);
  if (stewardInstallOrderEntries.length !== 1) {
    failures.push("default-crew installOrder must contain Steward exactly once");
  }

  return failures;
}

function readJson(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch (error) {
    throw new Error(
      `Cannot read ${label} at ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Fatal source-repository gate. Publishing a catalog without the protected
 * default-crew/Steward relationship is worse than publishing no catalog.
 */
export function assertDefaultCrewSourceInvariant(repoRoot: string): void {
  const source = {
    stewardManifest: readJson(
      join(repoRoot, "content", "agents", "aoa-steward", "manifest.json"),
      "Steward manifest",
    ),
    teamManifest: readJson(
      join(repoRoot, "content", "teams", "default-crew", "manifest.json"),
      "default-crew manifest",
    ),
    teamBody: readJson(
      join(repoRoot, "content", "teams", "default-crew", "team.json"),
      "default-crew team body",
    ),
  };
  const failures = validateDefaultCrewSource(source);
  if (failures.length > 0) {
    throw new Error(`Protected default crew source invariant failed: ${failures.join("; ")}`);
  }
}

/**
 * Fatal post-aggregation gate. This catches a valid-looking source relationship
 * whose Steward or team item was later rejected by schema/automated/dependency
 * checks.
 */
export function assertDefaultCrewCatalogInvariant(items: readonly CatalogItem[]): void {
  const stewardItems = items.filter((item) => item.id === STEWARD_AGENT_ID);
  const teamItems = items.filter((item) => item.id === DEFAULT_CREW_TEAM_ID);
  if (
    stewardItems.length !== 1 ||
    stewardItems[0].type !== "agent" ||
    stewardItems[0].status !== "active"
  ) {
    throw new Error("Published catalog must contain exactly one active Steward agent");
  }
  if (
    teamItems.length !== 1 ||
    teamItems[0].type !== "team" ||
    teamItems[0].status !== "active"
  ) {
    throw new Error("Published catalog must contain exactly one active default crew");
  }

  const stewardRequirements = (teamItems[0].requires ?? []).filter(
    (requirement) =>
      requirement.type === "agent" && requirement.id === STEWARD_AGENT_ID,
  );
  if (stewardRequirements.length !== 1) {
    throw new Error("Published default crew must require Steward exactly once");
  }
}
