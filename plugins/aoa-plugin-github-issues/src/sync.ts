/**
 * Sync logic between GitHub Issues and AoA issues.
 * Manages link state in plugin state storage and handles
 * bidirectional status + comment syncing.
 */

import type { PluginContext } from "@armyofagents/plugin-sdk";
import { STATE_KEYS } from "./constants.js";
import * as github from "./github.js";

export interface IssueLink {
  aoaIssueId: string;
  aoaCompanyId: string;
  ghOwner: string;
  ghRepo: string;
  ghNumber: number;
  ghHtmlUrl: string;
  syncDirection: "bidirectional" | "github-to-aoa" | "aoa-to-github";
  lastSyncAt: string;
  lastGhState: "open" | "closed";
  lastCommentSyncAt: string | null;
}

function linkStateKey(aoaIssueId: string): string {
  return `${STATE_KEYS.linkPrefix}${aoaIssueId}`;
}

function ghStateKey(owner: string, repo: string, number: number): string {
  return `${STATE_KEYS.ghPrefix}${owner}/${repo}#${number}`;
}

export async function getLink(
  ctx: PluginContext,
  aoaIssueId: string,
): Promise<IssueLink | null> {
  const raw = await ctx.state.get({
    scopeKind: "instance",
    scopeId: "default",
    stateKey: linkStateKey(aoaIssueId),
  });
  if (!raw) return null;
  return JSON.parse(String(raw)) as IssueLink;
}

export async function getLinkByGitHub(
  ctx: PluginContext,
  owner: string,
  repo: string,
  number: number,
): Promise<IssueLink | null> {
  const raw = await ctx.state.get({
    scopeKind: "instance",
    scopeId: "default",
    stateKey: ghStateKey(owner, repo, number),
  });
  if (!raw) return null;
  const aoaIssueId = String(raw);
  return getLink(ctx, aoaIssueId);
}

export async function createLink(
  ctx: PluginContext,
  params: {
    aoaIssueId: string;
    aoaCompanyId: string;
    ghOwner: string;
    ghRepo: string;
    ghNumber: number;
    ghHtmlUrl: string;
    ghState: "open" | "closed";
    syncDirection: IssueLink["syncDirection"];
  },
): Promise<IssueLink> {
  const link: IssueLink = {
    aoaIssueId: params.aoaIssueId,
    aoaCompanyId: params.aoaCompanyId,
    ghOwner: params.ghOwner,
    ghRepo: params.ghRepo,
    ghNumber: params.ghNumber,
    ghHtmlUrl: params.ghHtmlUrl,
    syncDirection: params.syncDirection,
    lastSyncAt: new Date().toISOString(),
    lastGhState: params.ghState,
    lastCommentSyncAt: null,
  };

  await ctx.state.set({
    scopeKind: "instance",
    scopeId: "default",
    stateKey: linkStateKey(params.aoaIssueId),
    value: JSON.stringify(link),
  });

  await ctx.state.set({
    scopeKind: "instance",
    scopeId: "default",
    stateKey: ghStateKey(params.ghOwner, params.ghRepo, params.ghNumber),
    value: params.aoaIssueId,
  });

  return link;
}

export async function removeLink(
  ctx: PluginContext,
  aoaIssueId: string,
): Promise<boolean> {
  const link = await getLink(ctx, aoaIssueId);
  if (!link) return false;

  await ctx.state.delete({
    scopeKind: "instance",
    scopeId: "default",
    stateKey: linkStateKey(aoaIssueId),
  });

  await ctx.state.delete({
    scopeKind: "instance",
    scopeId: "default",
    stateKey: ghStateKey(link.ghOwner, link.ghRepo, link.ghNumber),
  });

  return true;
}

async function updateLink(
  ctx: PluginContext,
  link: IssueLink,
): Promise<void> {
  link.lastSyncAt = new Date().toISOString();
  await ctx.state.set({
    scopeKind: "instance",
    scopeId: "default",
    stateKey: linkStateKey(link.aoaIssueId),
    value: JSON.stringify(link),
  });
}

/**
 * Map GitHub issue state to AoA issue status.
 */
function ghStateToAoaStatus(ghState: "open" | "closed"): string {
  return ghState === "closed" ? "done" : "in_progress";
}

/**
 * Map AoA issue status to GitHub issue state.
 */
function aoaStatusToGhState(status: string): "open" | "closed" {
  return status === "done" || status === "cancelled" ? "closed" : "open";
}

/**
 * Sync a linked GitHub issue's state to the AoA issue.
 */
export async function syncFromGitHub(
  ctx: PluginContext,
  link: IssueLink,
  ghIssue: github.GitHubIssue,
): Promise<void> {
  if (
    link.syncDirection === "aoa-to-github" ||
    ghIssue.state === link.lastGhState
  ) {
    return;
  }

  const newStatus = ghStateToAoaStatus(ghIssue.state);
  await ctx.issues.update(link.aoaIssueId, { status: newStatus });

  link.lastGhState = ghIssue.state;
  await updateLink(ctx, link);

  ctx.logger.info(
    `Synced GitHub ${link.ghOwner}/${link.ghRepo}#${link.ghNumber} (${ghIssue.state}) -> AoA ${link.aoaIssueId} (${newStatus})`,
  );
}

/**
 * Sync an AoA issue's status to the linked GitHub issue.
 */
export async function syncToGitHub(
  ctx: PluginContext,
  link: IssueLink,
  aoaStatus: string,
  token: string,
): Promise<void> {
  if (link.syncDirection === "github-to-aoa") return;

  const targetGhState = aoaStatusToGhState(aoaStatus);
  if (targetGhState === link.lastGhState) return;

  await github.updateIssueState(
    ctx.http.fetch.bind(ctx.http),
    token,
    link.ghOwner,
    link.ghRepo,
    link.ghNumber,
    targetGhState,
  );

  link.lastGhState = targetGhState;
  await updateLink(ctx, link);

  ctx.logger.info(
    `Synced AoA ${link.aoaIssueId} (${aoaStatus}) -> GitHub ${link.ghOwner}/${link.ghRepo}#${link.ghNumber} (${targetGhState})`,
  );
}

/**
 * Bridge new comments from GitHub to AoA.
 */
export async function syncCommentsFromGitHub(
  ctx: PluginContext,
  link: IssueLink,
  token: string,
): Promise<number> {
  const since = link.lastCommentSyncAt ?? link.lastSyncAt;
  const comments = await github.listComments(
    ctx.http.fetch.bind(ctx.http),
    token,
    link.ghOwner,
    link.ghRepo,
    link.ghNumber,
    since,
  );

  let bridged = 0;
  for (const comment of comments) {
    // Skip comments from the sync bot itself (contain the bridge marker)
    if (comment.body.includes("[synced from AoA]")) continue;

    await ctx.issues.addComment(link.aoaIssueId, {
      body: `**@${comment.user.login}** ([GitHub](${comment.html_url})):\n\n${comment.body}`,
    });
    bridged++;
  }

  if (bridged > 0) {
    link.lastCommentSyncAt = new Date().toISOString();
    await updateLink(ctx, link);
  }

  return bridged;
}

/**
 * Bridge an AoA comment to GitHub.
 */
export async function bridgeCommentToGitHub(
  ctx: PluginContext,
  link: IssueLink,
  token: string,
  commentBody: string,
  authorName: string,
): Promise<void> {
  if (link.syncDirection === "github-to-aoa") return;

  // Skip if this comment was bridged FROM GitHub (prevent echo loop)
  if (commentBody.includes("[GitHub](https://github.com/")) return;

  await github.createComment(
    ctx.http.fetch.bind(ctx.http),
    token,
    link.ghOwner,
    link.ghRepo,
    link.ghNumber,
    `**${authorName}** [synced from AoA]:\n\n${commentBody}`,
  );
}
