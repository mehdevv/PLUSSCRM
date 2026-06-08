import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { salesReps, type RepTier } from "@/lib/mock-data";
import { Award, Star, Zap, TrendingUp } from "lucide-react";

const PERIOD_TABS = ["Daily", "Weekly", "Monthly"];

const TIER_STYLES: Record<RepTier, { badge: string; ring: string; glow: string }> = {
  DIAMOND: { badge: "bg-blue-50 text-primary border-primary/40 font-bold", ring: "tier-diamond", glow: "0 0 16px 4px rgba(26,26,255,0.5)" },
  GOLD: { badge: "bg-yellow-50 text-yellow-800 border-yellow-400 font-bold", ring: "tier-gold", glow: "0 0 16px 4px rgba(234,179,8,0.7)" },
  SILVER: { badge: "bg-slate-50 text-slate-700 border-slate-300 font-bold", ring: "tier-silver", glow: "0 0 14px 3px rgba(148,163,184,0.8)" },
  BRONZE: { badge: "bg-amber-50 text-amber-800 border-amber-300 font-bold", ring: "tier-bronze", glow: "0 0 12px 3px rgba(180,83,9,0.5)" },
};

const RANK_BADGES: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "#FFD700", text: "#7A5200", label: "1st" },
  2: { bg: "#C0C0C0", text: "#4B5563", label: "2nd" },
  3: { bg: "#CD7F32", text: "#FFFFFF", label: "3rd" },
};

const BADGES = [
  { icon: Star, label: "Top Closer", color: "#F59E0B", condition: (r: typeof salesReps[0]) => r.dealsMTD >= 10 },
  { icon: Zap, label: "Speed Demon", color: "#1A1AFF", condition: (r: typeof salesReps[0]) => r.winRate >= 70 },
  { icon: TrendingUp, label: "Riser", color: "#10B981", condition: (r: typeof salesReps[0]) => r.points > 1000 },
];

const sortedReps = [...salesReps].sort((a, b) => b.points - a.points);

function PodiumCard({ rep, rank }: { rep: typeof salesReps[0]; rank: number }) {
  const style = TIER_STYLES[rep.tier];
  const badge = RANK_BADGES[rank];
  const heights: Record<number, string> = { 1: "h-32", 2: "h-24", 3: "h-20" };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold font-display text-white ${style.ring}`}
          style={{ backgroundColor: rep.color }}
        >
          {rep.initials}
        </div>
        <div
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ backgroundColor: badge.bg, color: badge.text }}
        >
          {rank}
        </div>
      </div>
      <div className="text-center">
        <div className="font-display font-bold text-sm text-foreground">{rep.name.split(" ")[0]}</div>
        <div className="text-xs text-muted-foreground">{rep.name.split(" ")[1]}</div>
        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border ${style.badge}`}>{rep.tier}</span>
      </div>
      <div className="text-center">
        <div className="font-display font-bold text-foreground">{rep.points.toLocaleString()}</div>
        <div className="text-[10px] text-muted-foreground">pts</div>
      </div>
      <div className={`${heights[rank]} w-20 rounded-t-xl flex items-end justify-center pb-2`} style={{ backgroundColor: `${rep.color}22`, border: `2px solid ${rep.color}44` }}>
        <span className="text-xs font-bold" style={{ color: rep.color }}>{badge.label}</span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("Monthly");

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Leaderboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Performance rankings · {period}</p>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setPeriod(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${tab.toLowerCase()}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-8 mb-6 shadow-sm">
          <div className="flex items-end justify-center gap-8">
            {[sortedReps[1], sortedReps[0], sortedReps[2]].map((rep, i) => (
              <PodiumCard key={rep.id} rep={rep} rank={i === 0 ? 2 : i === 1 ? 1 : 3} />
            ))}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left" data-testid="leaderboard-table">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rank</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Points</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deals Won</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Win Rate</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedReps.map((rep, index) => {
                const rank = index + 1;
                const style = TIER_STYLES[rep.tier];
                const repBadges = BADGES.filter((b) => b.condition(rep));
                return (
                  <tr key={rep.id} className={`hover:bg-muted/40 transition-colors ${rank <= 3 ? "bg-primary/[0.02]" : ""}`} data-testid={`leaderboard-row-${rep.id}`}>
                    <td className="px-4 py-3">
                      {rank <= 3 ? (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: RANK_BADGES[rank].bg, color: RANK_BADGES[rank].text }}
                        >
                          {rank}
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-medium">{rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${rank <= 3 ? style.ring : ""}`}
                          style={{ backgroundColor: rep.color }}
                        >
                          {rep.initials}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{rep.name}</div>
                          <div className="text-xs text-muted-foreground">{rep.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${style.badge}`}>
                        {rep.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-display font-bold text-foreground">{rep.points.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{rep.dealsMTD}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${rep.winRate}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{rep.winRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {repBadges.map((b) => (
                          <div key={b.label} className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${b.color}15`, color: b.color }} title={b.label}>
                            <b.icon className="w-3 h-3" />
                            <span className="hidden sm:inline">{b.label}</span>
                          </div>
                        ))}
                        {repBadges.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {(["DIAMOND", "GOLD", "SILVER", "BRONZE"] as RepTier[]).map((tier) => {
            const count = sortedReps.filter((r) => r.tier === tier).length;
            const style = TIER_STYLES[tier];
            return (
              <div key={tier} className="bg-card border border-card-border rounded-xl p-3 flex items-center gap-3">
                <Award className="w-5 h-5" style={{ color: tier === "DIAMOND" ? "#1A1AFF" : tier === "GOLD" ? "#EAB308" : tier === "SILVER" ? "#94A3B8" : "#B45309" }} />
                <div>
                  <div className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${style.badge}`}>{tier}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{count} rep{count !== 1 ? "s" : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sidebar>
  );
}
