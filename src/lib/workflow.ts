/**
 * Shared workflow helpers — resolves the ordered list of job stages an
 * organization sees in the Kanban, Calendar, badges, and status pickers.
 *
 * Storage lives on `Organization.settings.workflow.jobStages`:
 *
 *     { key: JobStageKey; label?: string; hidden?: boolean }[]
 *
 * If unset, we fall back to `JOB_STAGES` in the exact catalog order. The stage
 * KEYS are hardcoded (they're DB values); orgs can only reorder + relabel +
 * optionally hide stages, not invent new ones. A "Reset to defaults" button in
 * the settings UI clears the override.
 */

import {
  JOB_STAGES,
  JOB_STAGE_TONES,
  type JobStageKey,
} from "./production-catalog";

export type WorkflowStage = {
  key: JobStageKey;
  label: string;
  chip: string;
  dot: string;
  hidden?: boolean;
};

export type WorkflowOverride = {
  key: JobStageKey;
  label?: string;
  hidden?: boolean;
};

/**
 * Resolve the org's effective workflow from stored overrides. Always returns
 * every stage the platform knows about — override lists that are missing keys
 * (either from user removal or a platform-added stage) are appended at the
 * end in default order so nothing is silently dropped.
 */
export function resolveWorkflow(
  overrides: WorkflowOverride[] | null | undefined,
): WorkflowStage[] {
  const seen = new Set<JobStageKey>();
  const out: WorkflowStage[] = [];

  if (overrides) {
    for (const o of overrides) {
      const def = JOB_STAGES.find((s) => s.key === o.key);
      if (!def) continue; // silently drop unknown keys
      const tone = JOB_STAGE_TONES[o.key];
      out.push({
        key: o.key,
        label: (o.label ?? "").trim() || def.label,
        chip: tone.chip,
        dot: tone.dot,
        hidden: !!o.hidden,
      });
      seen.add(o.key);
    }
  }

  for (const def of JOB_STAGES) {
    if (seen.has(def.key)) continue;
    const tone = JOB_STAGE_TONES[def.key];
    out.push({
      key: def.key,
      label: def.label,
      chip: tone.chip,
      dot: tone.dot,
    });
  }

  return out;
}

/**
 * Read the workflow override array out of an Organization.settings JSON blob.
 * Tolerant of stale / malformed data.
 */
export function readWorkflowOverrides(
  settings: unknown,
): WorkflowOverride[] | null {
  if (!settings || typeof settings !== "object") return null;
  const wf = (settings as Record<string, unknown>).workflow;
  if (!wf || typeof wf !== "object") return null;
  const raw = (wf as Record<string, unknown>).jobStages;
  if (!Array.isArray(raw)) return null;
  const valid: WorkflowOverride[] = [];
  const knownKeys = new Set<JobStageKey>(JOB_STAGES.map((s) => s.key));
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.key !== "string" || !knownKeys.has(rec.key as JobStageKey)) continue;
    valid.push({
      key: rec.key as JobStageKey,
      label: typeof rec.label === "string" ? rec.label : undefined,
      hidden: rec.hidden === true,
    });
  }
  return valid.length > 0 ? valid : null;
}
