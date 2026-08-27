import "server-only";

import type { PatternProvider } from "../types";

/**
 * No-op pattern provider — no PPF pattern integrations available.
 * TODO(stretch:ppf.pattern_integration): ntense-cut bridge.
 */
export const noopPatternProvider: PatternProvider = {
  name: "noop",
  async listAvailablePatterns() {
    return [];
  },
  async requestCutFile() {
    throw new Error("No pattern provider configured for this organization.");
  },
  async healthCheck() {
    return { ok: true, checkedAt: new Date().toISOString(), message: "noop" };
  },
};
