import type { LeadStatus } from "@/types";
import { ADMIN_ONLY_ROUTES } from "./permissions";

export const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "#3B82F6",
  ASSIGNED: "#8B5CF6",
  CONTACTED: "#06B6D4",
  QUALIFYING: "#F59E0B",
  PROPOSAL: "#F97316",
  NEGOTIATION: "#EF4444",
  WON: "#10B981",
  LOST: "#6B7280",
  DORMANT: "#94A3B8",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  CONTACTED: "Contacted",
  QUALIFYING: "Qualifying",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  DORMANT: "Dormant",
};

export const LEAD_STATUS_LABELS = STATUS_LABELS;

/** Shown on the rep Leads board — Assigned then Contacted; further stages are in Pipeline */
export const LEADS_BOARD_STATUSES: LeadStatus[] = ["ASSIGNED", "CONTACTED"];

export const PIPELINE_LEAD_STATUSES: LeadStatus[] = [
  "CONTACTED", "QUALIFYING", "NEGOTIATION", "WON", "LOST",
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
