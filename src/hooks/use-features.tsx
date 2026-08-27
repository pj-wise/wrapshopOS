"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { FeatureKey } from "@/lib/features";
import type { ResolvedFeature } from "@/server/features/service";

type FeatureMap = Record<FeatureKey, ResolvedFeature>;

const FeatureContext = createContext<FeatureMap | null>(null);

export function FeatureProvider({
  features,
  children,
}: {
  features: FeatureMap;
  children: ReactNode;
}) {
  return <FeatureContext.Provider value={features}>{children}</FeatureContext.Provider>;
}

export function useFeatures(): FeatureMap {
  const ctx = useContext(FeatureContext);
  if (!ctx) throw new Error("useFeatures must be used inside <FeatureProvider>");
  return ctx;
}

export function useFeature(key: FeatureKey): ResolvedFeature {
  return useFeatures()[key];
}

export function useFeatureEnabled(key: FeatureKey): boolean {
  const f = useFeature(key);
  return f.state === "enabled" || f.state === "beta";
}
