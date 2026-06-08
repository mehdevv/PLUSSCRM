import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useActivities, useActivityMutations, useSalesReps, useLeads } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { useStaffView } from "@/hooks/useSuperMode";
import { formatDate } from "@/lib/format";
import { confirmDeleteMessage } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import type { Activity, ActivityType } from "@/types";
import { Phone, Mail, Users, FileText, CheckSquare, RefreshCw, MessageCircle, Plus, X, Trash2, type LucideIcon } from "lucide-react";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: FileText,
  TASK: CheckSquare,
  STAGE_CHANGE: RefreshCw,
  WHATSAPP: MessageCircle,
};

const ACTIVITY_COLORS: Record<string, string> = {
  CALL: "#1A1AFF",
  EMAIL: "#06B6D4",
  MEETING: "#8B5CF6",
  NOTE: "#F59E0B",
  TASK: "#F97316",
  STAGE_CHANGE: "#10B981",
  WHATSAPP: "#22C55E",
};

const ACTIVITY_TYPES: ActivityType[] = ["CALL", "EMAIL", "MEETING", "NOTE", "TASK", "WHATSAPP"];

const tabs = ["Activity Log", "Scheduled Tasks", "Call Log"];

function isScheduledTask(a: { type: ActivityType; done: boolean; due_date: string | null; scheduled_at: string | null }) {
  return a.type === "TASK" && !a.done && !!(a.due_date || a.scheduled_at);
}

export default function Activities() {
  const [activeTab, setActiveTab] = useState("Activity Log");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "CALL" as ActivityType, note: "", outcome: "", lead_id: "", due_date: "" });

  const { user } = useAuth();
  const { effectiveRepId, canStaffOverride, effectiveRep } = useStaffView();
  const { data: activities = [], isLoading, isError } = useActivities();
  const { data: salesReps = [] } = useSalesReps();
  const { data: leads = [] } = useLeads();
  const { toast } = useToast();
  const { create, complete, remove } = useActivityMutations();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get("lead");
    if (leadId) {
      setForm((f) => ({ ...f, lead_id: leadId }));
      setShowForm(true);
    }
  }, []);

  const scoped = effectiveRepId
    ? activities.filter((a) => a.user_id === effectiveRepId)
    : activities;
  const allActivities = scoped.filter((a) => !isScheduledTask(a));
  const scheduledTasks = scoped.filter(isScheduledTask);
  const callLog = scoped.filter((a) => a.type === "CALL");

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const actorId = effectiveRepId ?? user?.id;
    if (!actorId || !form.note.trim()) return;
    await create.mutateAsync({
      user_id: actorId,
      type: form.type,
      note: form.note.trim(),
      outcome: form.outcome.trim() || undefined,
      lead_id: form.lead_id || undefined,
      due_date: form.type === "TASK" && form.due_date ? form.due_date : undefined,
      scheduled_at: form.type === "TASK" && form.due_date ? new Date(form.due_date).toISOString() : undefined,
    });
    setForm({ type: "CALL", note: "", outcome: "", lead_id: "", due_date: "" });
    setShowForm(false);
  };

  const handleCompleteTask = (id: string) => {
    complete.mutate(id);
  };

  const handleDeleteActivity = (act: Activity) => {
    const label = act.lead_name ? `${act.type} — ${act.lead_name}` : act.type;
    if (!confirmDeleteMessage(label, "This activity will be permanently removed.")) return;
    setDeletingId(act.id);
    remove.mutate(act.id, {
      onSuccess: () => toast({ title: "Activity deleted" }),
      onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
      onSettled: () => setDeletingId(null),
    });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Activities</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {canStaffOverride && effectiveRep ? (
                <>Managing <strong>{effectiveRep.name}</strong>&apos;s activities — you can delete any entry</>
              ) : (
                <>All team touchpoints and tasks</>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            data-testid="btn-log-activity"
          >
            <Plus className="w-4 h-4" />Log Activity
          </button>
        </div>

        <div className="flex border-b border-border mb-5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.toLowerCase().replace(/\s/g, "-")}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-sm text-red-500">Failed to load activities.</div>
        ) : (
          <>
            {activeTab === "Activity Log" && (
              allActivities.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground">No activities logged yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {allActivities.map((act) => {
                    const Icon = ACTIVITY_ICONS[act.type] || FileText;
                    const rep = salesReps.find((r) => r.id === act.user_id);
                    return (
                      <div key={act.id} className="bg-card border border-card-border rounded-xl p-4 flex items-start gap-3 hover:shadow-sm transition-shadow" data-testid={`activity-${act.id}`}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ACTIVITY_COLORS[act.type]}18` }}>
                          <Icon className="w-4 h-4" style={{ color: ACTIVITY_COLORS[act.type] }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground">{act.lead_name}</span>
                                <span className="text-xs text-muted-foreground">{act.company}</span>
                                {act.outcome && (
                                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{act.outcome}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{act.note}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {canStaffOverride && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteActivity(act)}
                                  disabled={deletingId === act.id}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                  title="Delete activity"
                                  data-testid={`btn-delete-activity-${act.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {rep && (
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: rep.color }} title={rep.name}>
                                  {rep.initials}
                                </div>
                              )}
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(act.created_at, "MMM d, yyyy h:mm a")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {activeTab === "Scheduled Tasks" && (
              scheduledTasks.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground">No scheduled tasks.</div>
              ) : (
                <div className="space-y-2.5">
                  {scheduledTasks.map((task) => {
                    const rep = salesReps.find((r) => r.id === task.user_id);
                    const overdue = isOverdue(task.due_date);
                    return (
                      <div key={task.id} className={`bg-card border rounded-xl p-4 flex items-start gap-3 ${overdue ? "border-red-200 bg-red-50/30" : "border-card-border"}`} data-testid={`task-${task.id}`}>
                        <div className="w-9 h-9 flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary rounded cursor-pointer"
                            checked={task.done}
                            onChange={() => handleCompleteTask(task.id)}
                            disabled={complete.isPending}
                            data-testid={`checkbox-task-${task.id}`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">{task.lead_name} — {task.company}</span>
                            {task.priority && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                task.priority === "HIGH" ? "bg-red-50 text-red-600 border-red-200" :
                                task.priority === "MEDIUM" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-muted text-muted-foreground border-border"
                              }`}>{task.priority}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{task.note}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {rep && (
                              <div className="flex items-center gap-1">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: rep.color }}>{rep.initials}</div>
                                <span className="text-[10px] text-muted-foreground">{rep.name.split(" ")[0]}</span>
                              </div>
                            )}
                            <span className={`text-[10px] font-medium ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
                              Due: {formatDate(task.due_date)}
                            </span>
                            {canStaffOverride && (
                              <button
                                type="button"
                                onClick={() => handleDeleteActivity(task)}
                                disabled={deletingId === task.id}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto"
                                title="Delete task"
                                data-testid={`btn-delete-task-${task.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {activeTab === "Call Log" && (
              callLog.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground">No calls logged yet.</div>
              ) : (
                <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead / Company</th>
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outcome</th>
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                        {canStaffOverride && (
                          <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {callLog.map((call) => {
                        const rep = salesReps.find((r) => r.id === call.user_id);
                        return (
                          <tr key={call.id} className="hover:bg-muted/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{call.lead_name}</div>
                              <div className="text-xs text-muted-foreground">{call.company}</div>
                            </td>
                            <td className="px-4 py-3">
                              {rep && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: rep.color }}>{rep.initials}</div>
                                  <span className="text-xs">{rep.name.split(" ")[0]}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                call.outcome === "Answered" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                call.outcome === "Voicemail" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-muted text-muted-foreground border-border"
                              }`}>{call.outcome || "—"}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{call.note}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(call.created_at, "MMM d, yyyy h:mm a")}</td>
                            {canStaffOverride && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteActivity(call)}
                                  disabled={deletingId === call.id}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                  title="Delete call"
                                  data-testid={`btn-delete-call-${call.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-foreground">Log Activity</h2>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleLogActivity} className="space-y-3">
                <select
                  value={form.lead_id}
                  onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Link to lead (optional)</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} — {l.company}</option>
                  ))}
                </select>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ActivityType })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {form.type === "TASK" && (
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
                <input
                  placeholder="Outcome (optional)"
                  value={form.outcome}
                  onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <textarea
                  required
                  placeholder="Notes..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {create.isPending ? "Saving..." : "Log Activity"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
