import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useRepDashboard } from "@/hooks/queries";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { DashboardKpis, LeadStatus, Profile } from "@/types";
import { DollarSign, Target, TrendingUp, Activity, Users, X } from "lucide-react";

function ChangeBadge({ value }: { value?: number | null }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span className={`text-[10px] font-medium mt-1 ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? "+" : ""}{value}% vs last month
    </span>
  );
}

function RepKpiCards({ data, formatMoney }: { data: DashboardKpis; formatMoney: (n: number) => string }) {
  const cards = [
    { label: "Revenue MTD", value: formatMoney(data.totalRevenueMtd), icon: DollarSign, change: data.revenueChange },
    { label: "Deals Won MTD", value: String(data.dealsWonMtd), icon: Target, change: data.dealsWonChange },
    { label: "Win Rate", value: `${data.winRate}%`, icon: TrendingUp, change: data.winRateChange },
    { label: "Avg Deal Size", value: formatMoney(data.avgDealSize), icon: Activity, change: data.avgDealSizeChange },
    { label: "Pipeline Value", value: formatMoney(data.pipelineValue), icon: Users, change: data.pipelineChange },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {cards.map((kpi) => (
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
  );
}

interface RepPerformancePanelProps {
  rep: Profile;
  onClose: () => void;
  formatMoney: (amount: number) => string;
}

export function RepPerformancePanel({ rep, onClose, formatMoney }: RepPerformancePanelProps) {
  const { kpis, revenue, activityVolume, pipelineFunnel } = useRepDashboard(rep.id);

  const funnelData = (pipelineFunnel.data ?? []).map((item) => ({
    ...item,
    label: STATUS_LABELS[item.stage as LeadStatus] ?? item.stage,
    color: item.color ?? STATUS_COLORS[item.stage as LeadStatus] ?? "#6B7280",
  }));
  const maxFunnelCount = Math.max(...funnelData.map((item) => item.count), 1);

  return (
    <div className="bg-card border border-primary/20 rounded-xl shadow-sm overflow-hidden" data-testid="rep-performance-panel">
      <div className="flex items-center justify-between gap-4 p-5 border-b border-border bg-primary/[0.03]">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: rep.color }}
          >
            {rep.initials}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{rep.name}</h2>
            <p className="text-sm text-muted-foreground">{rep.email} · {rep.tier} tier</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
          <X className="w-4 h-4 mr-1" /> Close
        </Button>
      </div>

      <div className="p-5 space-y-6">
        {kpis.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="text-primary" />
          </div>
        ) : kpis.isError ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground mb-3">Failed to load rep performance.</p>
            <Button variant="outline" size="sm" onClick={() => kpis.refetch()}>Retry</Button>
          </div>
        ) : kpis.data ? (
          <RepKpiCards data={kpis.data} formatMoney={formatMoney} />
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <h3 className="font-display text-sm font-bold mb-3">Revenue Trend</h3>
            {revenue.isLoading ? (
              <div className="flex items-center justify-center h-[180px]"><Spinner className="text-primary" /></div>
            ) : revenue.isError ? (
              <p className="text-xs text-muted-foreground text-center py-10">Failed to load revenue trend.</p>
            ) : !revenue.data?.length ? (
              <p className="text-xs text-muted-foreground text-center py-10">No revenue recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={revenue.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [formatMoney(v), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))" }} />
                  <Line type="monotone" dataKey="revenue" stroke={rep.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <h3 className="font-display text-sm font-bold mb-3">Activity Volume (7 days)</h3>
            {activityVolume.isLoading ? (
              <div className="flex items-center justify-center h-[180px]"><Spinner className="text-primary" /></div>
            ) : activityVolume.isError ? (
              <p className="text-xs text-muted-foreground text-center py-10">Failed to load activity volume.</p>
            ) : !activityVolume.data?.length ? (
              <p className="text-xs text-muted-foreground text-center py-10">No activities logged this week.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={activityVolume.data} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))" }} />
                  <Bar dataKey="calls" name="Calls" fill="#1A1AFF" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="emails" name="Emails" fill="#06B6D4" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="meetings" name="Meetings" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-muted/30 border border-border rounded-xl p-4">
          <h3 className="font-display text-sm font-bold mb-3">Pipeline Funnel</h3>
          {pipelineFunnel.isLoading ? (
            <div className="flex items-center justify-center py-8"><Spinner className="text-primary" /></div>
          ) : pipelineFunnel.isError ? (
            <p className="text-xs text-muted-foreground text-center py-8">Failed to load pipeline.</p>
          ) : !funnelData.length ? (
            <p className="text-xs text-muted-foreground text-center py-8">No active leads in pipeline.</p>
          ) : (
            <div className="space-y-2">
              {funnelData.map((item) => (
                <div key={item.stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 text-right truncate">{item.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md"
                      style={{
                        width: `${(item.count / maxFunnelCount) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-10">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
