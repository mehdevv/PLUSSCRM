import type { Activity, ActivityType } from "@/types";
import {
  Phone, Mail, Users, FileText, CheckSquare, RefreshCw, MessageCircle,
  type LucideIcon,
} from "lucide-react";

export const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: FileText,
  TASK: CheckSquare,
  STAGE_CHANGE: RefreshCw,
  WHATSAPP: MessageCircle,
};

export const ACTIVITY_COLORS: Record<string, string> = {
  CALL: "#1A1AFF",
  EMAIL: "#06B6D4",
  MEETING: "#8B5CF6",
  NOTE: "#F59E0B",
  TASK: "#F97316",
  STAGE_CHANGE: "#10B981",
  WHATSAPP: "#22C55E",
};

export function groupActivitiesByLead(activities: Activity[]): Map<string, Activity[]> {
  const map = new Map<string, Activity[]>();
  for (const act of activities) {
    if (!act.lead_id) continue;
    const list = map.get(act.lead_id) ?? [];
    list.push(act);
    map.set(act.lead_id, list);
  }
  return map;
}

export function activitiesForLead(map: Map<string, Activity[]>, leadId: string, limit?: number): Activity[] {
  const list = map.get(leadId) ?? [];
  return limit != null ? list.slice(0, limit) : list;
}

export function activityTypeLabel(type: ActivityType): string {
  const labels: Partial<Record<ActivityType, string>> = {
    CALL: "Call",
    EMAIL: "Email",
    MEETING: "Meeting",
    NOTE: "Note",
    TASK: "Task",
    STAGE_CHANGE: "Stage change",
    WHATSAPP: "WhatsApp",
  };
  return labels[type] ?? type;
}
