import type { SourceAdapter, SourceAdapterContext, NormalizedItem } from "../../types/source-adapter.js";

export const githubSkillsAdapter: SourceAdapter = {
  id: "github-skills",
  displayName: "GitHub Skills",
  defaultTrustTier: "community",

  async fetch(_ctx: SourceAdapterContext): Promise<unknown> {
    throw new Error("not implemented yet");
  },

  async normalize(_raw: unknown, _ctx: SourceAdapterContext): Promise<NormalizedItem[]> {
    throw new Error("not implemented yet");
  },
};
