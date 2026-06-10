import { LEADS_RETURN_OPTIONS, PIPELINE_KANBAN_STAGES, STATUS_LABELS } from "@/lib/constants";
import type { PlatformSettings } from "@/types";
import type { LeadStatus } from "@/types";

export type FreemoveTarget =
  | { kind: "stage"; value: LeadStatus; label: string }
  | { kind: "leads"; value: string; label: string };

export const FREEMOVE_TARGETS: FreemoveTarget[] = [
  ...PIPELINE_KANBAN_STAGES.map((stage) => ({
    kind: "stage" as const,
    value: stage,
    label: STATUS_LABELS[stage],
  })),
  { kind: "stage", value: "WON", label: STATUS_LABELS.WON },
  { kind: "stage", value: "LOST", label: STATUS_LABELS.LOST },
  ...LEADS_RETURN_OPTIONS.map((o) => ({
    kind: "leads" as const,
    value: o.value,
    label: o.label,
  })),
];

export function repHasFreemove(
  settings: PlatformSettings | null | undefined,
  repId: string | undefined,
): boolean {
  if (!settings || !repId) return false;
  return (settings.freemove_rep_ids ?? []).includes(repId);
}
