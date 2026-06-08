import type { LeaderboardEntry, Profile, RepTier } from "@/types";
import { Spinner } from "@/components/ui/spinner";
import { ChevronRight } from "lucide-react";

const TIER_STYLES: Record<RepTier, string> = {
  BRONZE: "bg-amber-50 text-amber-800 border-amber-300",
  SILVER: "bg-slate-50 text-slate-700 border-slate-300",
  GOLD: "bg-yellow-50 text-yellow-800 border-yellow-400",
  DIAMOND: "bg-blue-50 text-primary border-primary/40",
};

export interface TeamRow {
  rep: Profile;
  stats?: LeaderboardEntry;
}

interface AdminTeamResultsProps {
  rows: TeamRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedRepId: string | null;
  onSelectRep: (repId: string) => void;
  formatMoney: (amount: number) => string;
}

export function AdminTeamResults({
  rows,
  isLoading,
  isError,
  onRetry,
  selectedRepId,
  onSelectRep,
  formatMoney,
}: AdminTeamResultsProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="font-display text-base font-bold text-foreground">Team Results</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select a rep to view their individual performance on this dashboard.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="text-primary" />
        </div>
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">Failed to load team results.</p>
          <button type="button" onClick={onRetry} className="text-sm font-medium text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No sales reps on the team yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left" data-testid="admin-team-results-table">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rank</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deals MTD</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Win Rate</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue MTD</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Points</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ rep, stats }) => {
                const selected = selectedRepId === rep.id;
                return (
                  <tr
                    key={rep.id}
                    onClick={() => onSelectRep(rep.id)}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${selected ? "bg-primary/5" : ""}`}
                    data-testid={`admin-team-row-${rep.id}`}
                  >
                    <td className="px-4 py-3 font-semibold text-muted-foreground">
                      {stats?.rank ? `#${stats.rank}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
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
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIER_STYLES[rep.tier]}`}>
                        {rep.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{stats?.deals_mtd ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${stats?.win_rate ?? 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{stats?.win_rate ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatMoney(stats?.revenue ?? 0)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(stats?.points ?? rep.points).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <ChevronRight className={`w-4 h-4 ${selected ? "text-primary" : ""}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
