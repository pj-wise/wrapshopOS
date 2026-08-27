import "server-only";

import type { AIProvider } from "../types";

/**
 * No-op AI provider. Returns a stub response so features can render without
 * an API key. Every AI feature is behind a FeatureGate — this exists so
 * server code that resolves the provider doesn't crash when no key is set.
 *
 * TODO(stretch:ai.assistant): AnthropicAIProvider + OpenAIAIProvider impls.
 */
export const noopAiProvider: AIProvider = {
  name: "noop",
  async generate() {
    return {
      text: "AI Assistant is not configured for this shop yet.",
      provider: "noop",
    };
  },
  async healthCheck() {
    return { ok: true, checkedAt: new Date().toISOString(), message: "noop" };
  },
};
