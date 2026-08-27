/**
 * Non-job calendar events. Distinct from the JOB_STAGES catalog (which
 * covers work-order lifecycle) — these are appointments the shop schedules
 * around jobs: consults with walk-ins, mid-install inspections, staff
 * meetings, ad-hoc blocks.
 *
 * `kind` values here also cover the ScheduleBlock.kind column ("consult" |
 * "inspection" | "meeting" | "other"). Legacy values "job" and "block"
 * remain accepted server-side for pre-existing rows but aren't user-pickable.
 */

export const EVENT_KINDS = [
  {
    key: "consult",
    label: "Consult",
    defaultColor: "sky",
    description: "Walk-in or scheduled quote conversation.",
  },
  {
    key: "inspection",
    label: "Inspection",
    defaultColor: "teal",
    description: "Vehicle drop-off pre-check or mid-install review.",
  },
  {
    key: "meeting",
    label: "Meeting",
    defaultColor: "violet",
    description: "Staff, vendor, or admin meeting.",
  },
  {
    key: "other",
    label: "Other",
    defaultColor: "slate",
    description: "Anything else you want on the calendar.",
  },
] as const;

export type EventKindKey = (typeof EVENT_KINDS)[number]["key"];
export const EVENT_KIND_KEYS = EVENT_KINDS.map((k) => k.key);

export function eventKindLabel(kind: string): string {
  return EVENT_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

/**
 * Palette users can pick from when overriding an event's chip color. Keys
 * are stable — Tailwind class strings are recomputed from the key at
 * render time so the DB never stores classnames (safer against palette
 * changes down the line).
 */
export const EVENT_COLORS = [
  {
    key: "sky",
    label: "Sky",
    dot: "bg-sky-500",
    chip:
      "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700/40 dark:bg-sky-500/20 dark:text-sky-100",
  },
  {
    key: "teal",
    label: "Teal",
    dot: "bg-teal-500",
    chip:
      "border-teal-300 bg-teal-100 text-teal-950 dark:border-teal-700/40 dark:bg-teal-500/20 dark:text-teal-100",
  },
  {
    key: "violet",
    label: "Violet",
    dot: "bg-violet-500",
    chip:
      "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700/40 dark:bg-violet-500/20 dark:text-violet-100",
  },
  {
    key: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    chip:
      "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700/40 dark:bg-amber-500/20 dark:text-amber-100",
  },
  {
    key: "rose",
    label: "Rose",
    dot: "bg-rose-500",
    chip:
      "border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700/40 dark:bg-rose-500/20 dark:text-rose-100",
  },
  {
    key: "emerald",
    label: "Emerald",
    dot: "bg-emerald-500",
    chip:
      "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700/40 dark:bg-emerald-500/20 dark:text-emerald-100",
  },
  {
    key: "orange",
    label: "Orange",
    dot: "bg-orange-500",
    chip:
      "border-orange-300 bg-orange-100 text-orange-950 dark:border-orange-700/40 dark:bg-orange-500/20 dark:text-orange-100",
  },
  {
    key: "slate",
    label: "Slate",
    dot: "bg-slate-500",
    chip:
      "border-slate-300 bg-slate-100 text-slate-950 dark:border-slate-700/40 dark:bg-slate-500/20 dark:text-slate-100",
  },
] as const;

export type EventColorKey = (typeof EVENT_COLORS)[number]["key"];
export const EVENT_COLOR_KEYS = EVENT_COLORS.map((c) => c.key);

/** Matches lowercase-or-uppercase 3- or 6-digit hex ("#abc" or "#aabbcc"). */
export const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(v: string | null | undefined): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

function expandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

/** Compute a simple contrast-safe text color (black or white) for a hex bg. */
function contrastText(hex: string): string {
  const h = expandHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#111" : "#fff";
}

/**
 * Result of `resolveEventTone`. For palette-based colors, `chip` + `dot` are
 * Tailwind class strings and `style` is undefined. For hex colors, `chip` is
 * a minimal utility class (`border`) and `style` carries the actual colors
 * (which callers must spread onto the chip element).
 */
export type ResolvedEventTone = {
  chip: string;
  dot: string;
  colorKey: string;
  style?: React.CSSProperties;
  dotStyle?: React.CSSProperties;
  hex?: string;
};

/**
 * Resolve the chip + dot styling for an event. Precedence: explicit `color`
 * override → the kind's `defaultColor` → slate. Accepts either a palette
 * key (e.g. "sky") or a hex string (e.g. "#f43f5e").
 */
export function resolveEventTone(
  kind: string | null | undefined,
  color: string | null | undefined,
): ResolvedEventTone {
  if (isHexColor(color)) {
    const hex = expandHex(color);
    const text = contrastText(hex);
    return {
      chip: "border",
      dot: "",
      colorKey: hex,
      hex,
      style: {
        backgroundColor: `${hex}33`,
        borderColor: hex,
        color: text === "#fff" ? "#f9fafb" : "#0a0a0a",
      },
      dotStyle: { backgroundColor: hex },
    };
  }
  const colorKey =
    (color && (EVENT_COLORS.find((c) => c.key === color)?.key as EventColorKey)) ||
    (EVENT_KINDS.find((k) => k.key === kind)?.defaultColor as EventColorKey) ||
    "slate";
  const tone = EVENT_COLORS.find((c) => c.key === colorKey) ?? EVENT_COLORS[EVENT_COLORS.length - 1];
  return { chip: tone.chip, dot: tone.dot, colorKey };
}

/**
 * Which Tailwind palette each JOB_STAGE currently uses — parsed from the
 * `dot` class in JOB_STAGE_TONES so it stays in sync automatically. Used to
 * warn users in the New Event dialog when they'd be picking a color that
 * already means something on the calendar.
 *
 * Kept as an import-side effect-free plain function so it can be called
 * from a component's render pass without pulling `production-catalog` into
 * this file's static analysis graph.
 */
import { JOB_STAGES, JOB_STAGE_TONES } from "./production-catalog";

/**
 * Map palette key (e.g. "sky") → array of job-stage labels that use it.
 * Uses the platform default labels; the calendar can pass in the org's
 * workflow-resolved labels to swap them in.
 */
export function paletteAssignmentsFromStages(
  stageLabelOverrides?: Record<string, string>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of JOB_STAGES) {
    const tone = JOB_STAGE_TONES[s.key];
    // Extract "sky" from "bg-sky-500" → the palette key we store.
    const m = /^bg-([a-z]+)-\d+$/.exec(tone.dot);
    if (!m) continue;
    const paletteKey = m[1];
    const label = stageLabelOverrides?.[s.key] ?? s.label;
    if (!out[paletteKey]) out[paletteKey] = [];
    out[paletteKey].push(label);
  }
  return out;
}
