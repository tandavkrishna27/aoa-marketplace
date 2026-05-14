import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import type { SkillBundle } from "../types/catalog.js";

export interface InstallSkillBundleOptions {
  destination: string;
  overwrite?: boolean;
  repoUrl?: string;
}

export interface InstallSkillBundleResult {
  destination: string;
  fileCount: number;
  byteCount: number;
}

export function validateSkillBundlePath(path: string): void {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");

  if (
    normalized.length === 0 ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe bundle path: ${path}`);
  }
}

export function installSkillBundle(
  bundle: SkillBundle,
  options: InstallSkillBundleOptions,
): InstallSkillBundleResult {
  if (bundle.type !== "github-directory") {
    throw new Error(`Unsupported skill bundle type: ${bundle.type}`);
  }

  validateSkillBundlePath(bundle.path);
  const destination = resolve(options.destination);
  assertSafeDestination(destination);

  const tempRoot = mkdtempSync(join(tmpdir(), "skill-bundle-install-"));
  const checkoutDir = join(tempRoot, "repo");

  try {
    const repoUrl = options.repoUrl ?? resolveRepoUrl(bundle.repo);
    execFileSync("git", ["clone", "-c", "core.autocrlf=false", "--no-checkout", repoUrl, checkoutDir], {
      stdio: "ignore",
    });
    execFileSync("git", ["checkout", "--detach", bundle.commitSha], {
      cwd: checkoutDir,
      stdio: "ignore",
    });

    const sourceDir = resolve(checkoutDir, ...bundle.path.replace(/\\/g, "/").split("/"));
    assertInsideDirectory(checkoutDir, sourceDir, "Bundle path escapes checkout");

    const skillFile = join(sourceDir, "SKILL.md");
    if (!existsSync(skillFile) || !statSync(skillFile).isFile()) {
      throw new Error(`Bundle directory does not contain SKILL.md: ${bundle.path}`);
    }

    assertDestinationOutsideSource(checkoutDir, destination);
    prepareDestination(destination, options.overwrite === true);

    const result = copyDirectory(sourceDir, destination);
    return {
      destination,
      fileCount: result.fileCount,
      byteCount: result.byteCount,
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function resolveRepoUrl(repo: string): string {
  return `https://github.com/${repo}.git`;
}

function assertSafeDestination(destination: string): void {
  if (!isAbsolute(destination)) {
    throw new Error(`Destination must resolve to an absolute path: ${destination}`);
  }

  if (destination === parse(destination).root) {
    throw new Error(`Refusing to install bundle into filesystem root: ${destination}`);
  }
}

function assertDestinationOutsideSource(sourceRoot: string, destination: string): void {
  const source = withTrailingSeparator(resolve(sourceRoot));
  const dest = withTrailingSeparator(resolve(destination));
  if (dest.startsWith(source)) {
    throw new Error("Destination must not be inside the source checkout");
  }
}

function prepareDestination(destination: string, overwrite: boolean): void {
  if (existsSync(destination)) {
    if (!overwrite) {
      throw new Error(`Destination already exists: ${destination}`);
    }
    rmSync(destination, { recursive: true, force: true });
  }
  mkdirSync(dirname(destination), { recursive: true });
}

function copyDirectory(source: string, destination: string): { fileCount: number; byteCount: number } {
  let fileCount = 0;
  let byteCount = 0;

  function copyEntry(from: string, to: string): void {
    assertInsideDirectory(destination, to, "Copy target escapes destination");
    const entry = lstatSync(from);

    if (entry.isSymbolicLink()) {
      return;
    }

    if (entry.isDirectory()) {
      mkdirSync(to, { recursive: true });
      for (const child of readdirSync(from)) {
        copyEntry(join(from, child), join(to, child));
      }
      return;
    }

    if (entry.isFile()) {
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to);
      fileCount += 1;
      byteCount += entry.size;
    }
  }

  copyEntry(resolve(source), resolve(destination));
  return { fileCount, byteCount };
}

function assertInsideDirectory(root: string, candidate: string, message: string): void {
  const fromRoot = relative(resolve(root), resolve(candidate));
  if (fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))) {
    return;
  }
  throw new Error(message);
}

function withTrailingSeparator(path: string): string {
  return path.endsWith(sep) ? path : `${path}${sep}`;
}
