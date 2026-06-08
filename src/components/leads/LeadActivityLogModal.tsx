import { useLocation } from "wouter";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, activityTypeLabel } from "@/lib/activity-display";
import type { Activity } from "@/types";
import { X, FileText, ClipboardList } from "lucide-react";

interface LeadActivityLogModalProps {
  leadId: string | null;
  leadName: string;
  activities: Activity[];
  open: boolean;
  onClose: () => void;
}

export function LeadActivityLogModal({ leadId, leadName, activities, open, onClose }: LeadActivityLogModalProps) {
  const [, setLocation] = useLocation();

  if (!open || !leadId) return null;

  const leadActivities = activities.filter((a) => a.lead_id === leadId);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground">Activity log</h2>
            <p className="text-sm text-muted-foreground truncate">{leadName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {leadActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 italic">No activities logged for this lead yet.</p>
          ) : (
            leadActivities.map((act) => {
              const Icon = ACTIVITY_ICONS[act.type] || FileText;
              const color = ACTIVITY_COLORS[act.type] ?? "#6B7280";
              return (
                <div key={act.id} className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{activityTypeLabel(act.type)}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap" title={formatDate(act.created_at, "MMM d, yyyy h:mm a")}>
                        {formatRelativeTime(act.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 leading-snug">{act.note}</p>
                    {act.outcome && (
                      <span className="inline-block mt-1 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                        {act.outcome}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              setLocation(`/activities?lead=${leadId}`);
            }}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" /> Log activity
          </button>
        </div>
      </div>
    </div>
  );
}
