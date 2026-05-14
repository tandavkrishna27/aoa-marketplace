import semver from "semver";
import type { CatalogItem } from "../types/catalog.js";

export interface DependencyGraphValidationResult {
  failuresByItemId: Map<string, string[]>;
}

function addFailure(map: Map<string, string[]>, itemId: string, message: string): void {
  const existing = map.get(itemId) ?? [];
  existing.push(message);
  map.set(itemId, existing);
}

export function validateCatalogDependencies(items: CatalogItem[]): DependencyGraphValidationResult {
  const failuresByItemId = new Map<string, string[]>();
  const byId = new Map(items.map((item) => [item.id, item]));

  for (const item of items) {
    const seen = new Set<string>();
    for (const req of item.requires ?? []) {
      if (seen.has(req.id)) {
        addFailure(failuresByItemId, item.id, `duplicate dependency: ${req.id}`);
        continue;
      }
      seen.add(req.id);

      const target = byId.get(req.id);
      if (!target) {
        addFailure(failuresByItemId, item.id, `Required catalog item not found: ${req.id}`);
        continue;
      }
      if (target.type !== req.type) {
        addFailure(
          failuresByItemId,
          item.id,
          `Required catalog item type mismatch for ${req.id}: manifest declares ${req.type}, catalog has ${target.type}`,
        );
      }
      if (req.versionRange) {
        if (!semver.validRange(req.versionRange)) {
          addFailure(failuresByItemId, item.id, `invalid versionRange for ${req.id}: ${req.versionRange}`);
        } else if (semver.valid(target.version) && !semver.satisfies(target.version, req.versionRange)) {
          addFailure(
            failuresByItemId,
            item.id,
            `dependency ${req.id}@${target.version} does not satisfy ${req.versionRange}`,
          );
        }
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(item: CatalogItem): void {
    if (visited.has(item.id)) return;
    if (visiting.has(item.id)) {
      const cycleStart = stack.indexOf(item.id);
      const cycle = cycleStart >= 0 ? stack.slice(cycleStart).concat(item.id) : [item.id, item.id];
      for (const id of new Set(cycle)) {
        addFailure(failuresByItemId, id, `dependency cycle detected: ${cycle.join(" -> ")}`);
      }
      return;
    }

    visiting.add(item.id);
    stack.push(item.id);
    for (const req of item.requires ?? []) {
      const target = byId.get(req.id);
      if (target) visit(target);
    }
    stack.pop();
    visiting.delete(item.id);
    visited.add(item.id);
  }

  for (const item of items) visit(item);

  return { failuresByItemId };
}
