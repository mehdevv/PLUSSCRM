import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { mockActivities, salesReps } from "@/lib/mock-data";
import { Phone, Mail, Users, FileText, CheckSquare, RefreshCw, MessageCircle, Plus } from "lucide-react";

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

const tabs = ["Activity Log", "Scheduled Tasks", "Call Log"];

export default function Activities() {
  const [activeTab, setActiveTab] = useState("Activity Log");

  const allActivities = mockActivities.filter((a) => !a.scheduled);
  const scheduledTasks = mockActivities.filter((a) => a.scheduled);
  const callLog = mockActivities.filter((a) => a.type === "CALL");

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Activities</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All team touchpoints and tasks</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-log-activity">
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

        {activeTab === "Activity Log" && (
          <div className="space-y-2.5">
            {allActivities.map((act) => {
              const Icon = ACTIVITY_ICONS[act.type] || FileText;
              const rep = salesReps.find((r) => r.id === act.repId);
              return (
                <div key={act.id} className="bg-card border border-card-border rounded-xl p-4 flex items-start gap-3 hover:shadow-sm transition-shadow" data-testid={`activity-${act.id}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ACTIVITY_COLORS[act.type]}18` }}>
                    <Icon className="w-4 h-4" style={{ color: ACTIVITY_COLORS[act.type] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{act.leadName}</span>
                          <span className="text-xs text-muted-foreground">{act.company}</span>
                          {act.outcome && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{act.outcome}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{act.note}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {rep && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: rep.color }} title={rep.name}>
                            {rep.initials}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{act.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "Scheduled Tasks" && (
          <div className="space-y-2.5">
            {scheduledTasks.map((task) => {
              const rep = salesReps.find((r) => r.id === task.repId);
              const overdue = task.dueDate && task.dueDate < "Jun 8, 2025";
              return (
                <div key={task.id} className={`bg-card border rounded-xl p-4 flex items-start gap-3 ${overdue ? "border-red-200 bg-red-50/30" : "border-card-border"}`} data-testid={`task-${task.id}`}>
                  <div className="w-9 h-9 flex items-center justify-center">
                    <input type="checkbox" className="w-4 h-4 accent-primary rounded cursor-pointer" defaultChecked={task.done} data-testid={`checkbox-task-${task.id}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{task.leadName} — {task.company}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        task.priority === "HIGH" ? "bg-red-50 text-red-600 border-red-200" :
                        task.priority === "MEDIUM" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>{task.priority}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{task.note}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {rep && (
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: rep.color }}>{rep.initials}</div>
                          <span className="text-[10px] text-muted-foreground">{rep.name.split(" ")[0]}</span>
                        </div>
                      )}
                      <span className={`text-[10px] font-medium ${overdue ? "text-red-500" : "text-muted-foreground"}`}>Due: {task.dueDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "Call Log" && (
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead / Company</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outcome</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {callLog.map((call) => {
                  const rep = salesReps.find((r) => r.id === call.repId);
                  return (
                    <tr key={call.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{call.leadName}</div>
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
                      <td className="px-4 py-3 text-xs text-muted-foreground">{call.timestamp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
