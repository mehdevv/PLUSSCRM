import type { LeadStatus } from "@/types";
import { ADMIN_ONLY_ROUTES } from "./permissions";

export const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "#3B82F6",
  ASSIGNED: "#8B5CF6",
  CONTACTED: "#06B6D4",
  QUALIFIED: "#F59E0B",
  FOLLOW_UP: "#F97316",
  MEETING_PENDING: "#8B5CF6",
  QUALIFYING: "#F59E0B",
  PROPOSAL: "#F97316",
  NEGOTIATION: "#8B5CF6",
  WON: "#10B981",
  LOST: "#6B7280",
  DORMANT: "#94A3B8",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  FOLLOW_UP: "Follow up",
  MEETING_PENDING: "Meeting pending",
  QUALIFYING: "Qualified",
  PROPOSAL: "Follow up",
  NEGOTIATION: "Meeting pending",
  WON: "Won",
  LOST: "Lost",
  DORMANT: "Dormant",
};

/** Active pipeline kanban columns (left → right) */
export const PIPELINE_KANBAN_STAGES: LeadStatus[] = [
  "CONTACTED",
  "QUALIFIED",
  "FOLLOW_UP",
  "MEETING_PENDING",
];

/** All in-pipeline stages including legacy values (pre-migration data) */
export const ACTIVE_PIPELINE_STAGES: LeadStatus[] = [
  ...PIPELINE_KANBAN_STAGES,
  "QUALIFYING",
  "PROPOSAL",
  "NEGOTIATION",
];

export function normalizePipelineStage(stage: LeadStatus): LeadStatus {
  switch (stage) {
    case "QUALIFYING":
      return "QUALIFIED";
    case "PROPOSAL":
      return "FOLLOW_UP";
    case "NEGOTIATION":
      return "MEETING_PENDING";
    default:
      return stage;
  }
}

/** Write pipeline stages using enum values that exist before migration 019 (still valid after). */
export function toDbPipelineStage(stage: LeadStatus): LeadStatus {
  switch (stage) {
    case "QUALIFIED":
      return "QUALIFYING";
    case "FOLLOW_UP":
      return "PROPOSAL";
    case "MEETING_PENDING":
      return "NEGOTIATION";
    default:
      return stage;
  }
}

export const LEAD_STATUS_LABELS = STATUS_LABELS;

/** Shown on the rep Leads board — Assigned then Contacted; further stages are in Pipeline */
export const LEADS_BOARD_STATUSES: LeadStatus[] = ["ASSIGNED", "CONTACTED"];

export const PIPELINE_LEAD_STATUSES: LeadStatus[] = [
  ...PIPELINE_KANBAN_STAGES,
  "WON",
  "LOST",
];

/** Virtual values for returning a pipeline deal to the Leads board */
export const LEADS_RETURN_OPTIONS = [
  { value: "LEADS:ASSIGNED", label: "Leads — Assigned", status: "ASSIGNED" as const },
  { value: "LEADS:CONTACTED", label: "Leads — Contacted", status: "CONTACTED" as const },
];

/** Public sales rep sign-in */
export const REP_LOGIN_PATH = "/login";

/** Hidden admin sign-in — not linked in the app UI */
export const ADMIN_LOGIN_PATH = "/portal/staff";

export function isAdminOnlyRoute(path: string): boolean {
  return ADMIN_ONLY_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
}

export function getLoginPathForRoute(path: string): string {
  return isAdminOnlyRoute(path) ? ADMIN_LOGIN_PATH : REP_LOGIN_PATH;
}

export function getLogoutPath(role: "admin" | "sales_rep" | undefined): string {
  return role === "admin" ? ADMIN_LOGIN_PATH : REP_LOGIN_PATH;
}
