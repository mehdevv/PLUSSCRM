import { formatRelativeTime } from "@/lib/format";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, activityTypeLabel } from "@/lib/activity-display";
import type { Activity } from "@/types";
import { FileText, List } from "lucide-react";

interface LeadActivityPreviewProps {
  leadId: string;
  activities: Activity[];
  onViewAll: (leadId: string) => void;
  compact?: boolean;
}

export function LeadActivityPreview({ leadId, activities, onViewAll, compact }: LeadActivityPreviewProps) {
  const recent = activities.slice(0, 2);

  return (
    <div className="border-t border-border/60 pt-2 space-y-1.5" data-testid={`lead-activities-${leadId}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</span>
        <button
          type="button"
          onClick={() => onViewAll(leadId)}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
          data-testid={`btn-all-activities-${leadId}`}
        >
          <List className="w-3 h-3" /> All activity
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/60 italic">No activity logged yet</p>
      ) : (
        <ul className="space-y-1">
          {recent.map((act) => {
            const Icon = ACTIVITY_ICONS[act.type] || FileText;
            const color = ACTIVITY_COLORS[act.type] ?? "#6B7280";
            return (
              <li key={act.id} className="flex items-start gap-1.5 min-w-0">
                <Icon className="w-3 h-3 shrink-0 mt-0.5" style={{ color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={`font-medium text-foreground ${compact ? "text-[10px]" : "text-[11px]"}`}>
                      {activityTypeLabel(act.type)}
                    </span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{formatRelativeTime(act.created_at)}</span>
                  </div>
                  <p className={`text-muted-foreground truncate ${compact ? "text-[10px]" : "text-[11px]"}`}>{act.note}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
