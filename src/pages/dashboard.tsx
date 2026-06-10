import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AdminTeamResults } from "@/components/dashboard/AdminTeamResults";
import { RepPerformancePanel } from "@/components/dashboard/RepPerformancePanel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
} from "recharts";
import { useDashboard, useLeaderboard, useLeads, usePayments, useSalesReps } from "@/hooks/queries";
import { MrrKpiCard } from "@/components/dashboard/MrrKpiCard";
import { formatRelativeTime } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { ActivityFeedItem, DashboardKpis, LeadStatus } from "@/types";
import { TrendingUp, TrendingDown, Target, Activity, Users, Trophy, Star } from "lucide-react";
import { format } from "date-fns";
import type { UseQueryResult } from "@tanstack/react-query";

function WidgetError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}

function WidgetEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function WidgetShell<T>({
  query,
  height = "h-40",
  emptyMessage,
  isEmpty,
  children,
}: {
  query: UseQueryResult<T>;
  height?: string;
  emptyMessage?: string;
  isEmpty?: (data: T | undefined) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div className={`flex items-center justify-center ${height}`}>
        <Spinner className="text-primary" />
      </div>
    );
  }
  if (query.isError) {
    return <WidgetError message="Failed to load data" onRetry={() => query.refetch()} />;
  }
  if (emptyMessage && isEmpty?.(query.data)) {
    return <WidgetEmpty message={emptyMessage} />;
  }
  return <>{children(query.data as T)}</>;
}

function buildActivityAction(item: ActivityFeedItem): string {
  if (item.note) return item.note;
  const company = item.leads?.company;
  const typeLabels: Record<string, string> = {
    CALL: "logged a call",
    EMAIL: "sent an email",
    MEETING: "had a meeting",
    NOTE: "added a note",
    TASK: "completed a task",
    STAGE_CHANGE: "updated deal stage",
    WHATSAPP: "sent a WhatsApp message",
  };
  const action = typeLabels[item.type] ?? item.type.toLowerCase().replace("_", " ");
  return company ? `${action} with ${company}` : action;
}

function ChangeBadge({ value }: { value?: number | null }) {
  if (value == null) return null;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-1 ${positive ? "text-emerald-600" : "text-red-500"}`}>
      <Icon className="w-3 h-3" />
      {positive ? "+" : ""}{value}% vs last month
    </span>
  );
}

function buildKpiCards(
  kpiData: DashboardKpis,
  isAdmin: boolean,
  formatMoney: (n: number) => string,
) {
  const prefix = isAdmin ? "Total" : "My";
  return [
    { label: `${isAdmin ? "Deals Won This Month" : "My Deals Won MTD"}`, value: String(kpiData.dealsWonMtd), icon: Target, change: kpiData.dealsWonChange },
    { label: `${prefix} Win Rate`, value: `${kpiData.winRate}%`, icon: TrendingUp, change: kpiData.winRateChange },
    { label: `${isAdmin ? "Average Deal Size" : "My Avg Deal Size"}`, value: formatMoney(kpiData.avgDealSize), icon: Activity, change: kpiData.avgDealSizeChange },
    { label: `${prefix} Pipeline Value`, value: formatMoney(kpiData.pipelineValue), icon: Users, change: kpiData.pipelineChange },
  ];
}

export default function Dashboard() {
  const { formatMoney } = useCurrency();
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const {
    kpis, revenue, activityVolume, leadsBySource, pipelineFunnel,
    splitEfficiency, activityFeed, leaderboard, isAdmin, profile, user,
  } = useDashboard();
  const { data: adminLeaderboard, isLoading: adminLbLoading, isError: adminLbError, refetch: refetchAdminLb } = useLeaderboard("monthly", isAdmin);
  const { data: salesReps = [] } = useSalesReps();
  const { data: leads = [] } = useLeads();
  const { data: payments = [] } = usePayments();

  const myRank = leaderboard.data?.find((e) => e.user_id === user?.id);

  const teamRows = useMemo(() => {
    const statsMap = new Map((adminLeaderboard ?? []).map((e) => [e.user_id, e]));
    return salesReps
      .filter((r) => r.role === "sales_rep")
      .map((rep) => ({ rep, stats: statsMap.get(rep.id) }))
      .sort((a, b) => (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0));
  }, [salesReps, adminLeaderboard]);

  const selectedRep = selectedRepId ? salesReps.find((r) => r.id === selectedRepId) : undefined;

  const funnelData = (pipelineFunnel.data ?? []).map((item) => ({
    ...item,
    label: STATUS_LABELS[item.stage as LeadStatus] ?? item.stage,
    color: item.color ?? STATUS_COLORS[item.stage as LeadStatus] ?? "#6B7280",
  }));
  const maxFunnelCount = Math.max(...funnelData.map((item) => item.count), 1);

  return (
    <Sidebar>
      <div className="p-6 space-y-6 min-h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin ? "Company-wide performance" : "Your performance"} · {format(new Date(), "MMMM yyyy")}
            </p>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
            {isAdmin ? "Admin View" : "My Performance"}
          </span>
        </div>

        {!isAdmin && profile && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Points</p>
                <p className="font-display text-xl font-bold">{profile.points.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tier</p>
                <p className="font-display text-xl font-bold">{profile.tier}</p>
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Rank</p>
                <p className="font-display text-xl font-bold">
                  {leaderboard.isLoading ? "…" : myRank ? `#${myRank.rank}` : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Widget 1: KPI Cards */}
        <WidgetShell
          query={kpis}
          height="h-24"
          isEmpty={() => false}
        >
          {(kpiData) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <MrrKpiCard
                payments={payments}
                leads={leads}
                isAdmin={isAdmin}
                repId={user?.id}
              />
              {buildKpiCards(kpiData, isAdmin, formatMoney).map((kpi) => (
                <div key={kpi.label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</span>
                    <kpi.icon className="w-4 h-4 text-primary opacity-60" />
                  </div>
                  <div className="font-display text-2xl font-bold text-foreground">{kpi.value}</div>
                  <ChangeBadge value={kpi.change} />
                </div>
              ))}
            </div>
          )}
        </WidgetShell>

        {isAdmin && (
          <div className="space-y-6">
            <AdminTeamResults
              rows={teamRows}
              isLoading={adminLbLoading}
              isError={adminLbError}
              onRetry={() => refetchAdminLb()}
              selectedRepId={selectedRepId}
              onSelectRep={setSelectedRepId}
              formatMoney={formatMoney}
            />
            {selectedRep && (
              <RepPerformancePanel
                rep={selectedRep}
                onClose={() => setSelectedRepId(null)}
                formatMoney={formatMoney}
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Widget 2: Revenue Trend */}
          <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-bold">Revenue Trend</h2>
              <span className="text-xs text-muted-foreground">Last 12 months</span>
            </div>
            <WidgetShell
              query={revenue}
              height="h-[220px]"
              emptyMessage="No revenue recorded in the last 12 months"
              isEmpty={(data) => !data?.length || data.every((d) => d.revenue === 0)}
            >
              {(data) => (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `$${v / 1000}K`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="revenue" stroke="#1A1AFF" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#1A1AFF" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </WidgetShell>
          </div>

          {/* Widget 3: Activity Feed */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-4">Activity Feed</h2>
            <WidgetShell
              query={activityFeed}
              height="h-64"
              emptyMessage="No recent activity"
              isEmpty={(data) => !data?.length}
            >
              {(feedItems) => (
                <div className="space-y-3 overflow-y-auto max-h-64">
                  {feedItems.map((item) => {
                    const p = item.profiles;
                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: p?.color ?? "#6B7280" }}
                        >
                          {p?.initials ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground">
                            <span className="font-semibold">{p?.name ?? "Unknown"}</span>{" "}
                            {buildActivityAction(item)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(item.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </WidgetShell>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Widget 4: Pipeline Funnel */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm xl:col-span-2">
            <h2 className="font-display text-base font-bold mb-4">Pipeline Funnel</h2>
            <WidgetShell
              query={pipelineFunnel}
              height="h-40"
              emptyMessage="No active leads in pipeline"
              isEmpty={(data) => !data?.length}
            >
              {() => (
                <div className="space-y-2">
                  {funnelData.map((item) => (
                    <div key={item.stage} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 text-right truncate">{item.label}</span>
                      <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md transition-all"
                          style={{
                            width: `${(item.count / maxFunnelCount) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-10">{item.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </WidgetShell>
          </div>

          {/* Widget 5: Leads by Source */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-4">Leads by Source</h2>
            <WidgetShell
              query={leadsBySource}
              height="h-40"
              emptyMessage="No leads with source data"
              isEmpty={(data) => !data?.length}
            >
              {(sourceData) => (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, _name: string, props: { payload?: { count?: number; name?: string } }) => {
                          const count = props.payload?.count ?? 0;
                          return [`${v}% (${count} leads)`, props.payload?.name ?? ""];
                        }}
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-1">
                    {sourceData.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-muted-foreground">{s.name}</span>
                        </div>
                        <span className="font-semibold">{s.value}% <span className="text-muted-foreground font-normal">({s.count})</span></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </WidgetShell>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Widget 6: Activity Volume */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-4">Activity Volume (Last 7 Days)</h2>
            <WidgetShell
              query={activityVolume}
              height="h-[200px]"
              emptyMessage="No activities logged this week"
              isEmpty={(data) => !data?.length || data.every((d) => d.calls === 0 && d.emails === 0 && d.meetings === 0)}
            >
              {(data) => (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="calls" name="Calls" fill="#1A1AFF" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="emails" name="Emails" fill="#06B6D4" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="meetings" name="Meetings" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-primary" />Calls</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-cyan-400" />Emails</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-amber-400" />Meetings</div>
                  </div>
                </>
              )}
            </WidgetShell>
          </div>

          {/* Widget 8: Split Rule Efficiency (admin) */}
          {isAdmin && (
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <h2 className="font-display text-base font-bold mb-4">Split Rule Efficiency</h2>
              <WidgetShell
                query={splitEfficiency}
                height="h-[200px]"
                emptyMessage="No active split rules"
                isEmpty={(data) => !data?.length}
              >
                {(data) => (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip
                        formatter={(v: number, _name: string, props: { payload?: { deals?: number } }) => [
                          `${v}% win rate (${props.payload?.deals ?? 0} leads)`,
                          "Efficiency",
                        ]}
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="winRate" name="Win Rate" fill="#1A1AFF" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="winRate" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </WidgetShell>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
