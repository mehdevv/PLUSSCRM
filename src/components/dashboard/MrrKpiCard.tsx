import { useMemo, useState } from "react";
import { DollarSign, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatClientLtvAmount } from "@/lib/client-ltv";
import { buildMrrHistory, currentMrr, mrrMonthOverMonthChange } from "@/lib/mrr";
import type { Lead, Payment } from "@/types";

function ChangeBadge({ value }: { value?: number | null }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-1 ${positive ? "text-emerald-600" : "text-red-500"}`}>
      {positive ? "+" : ""}{value}% vs last month
    </span>
  );
}

type MrrKpiCardProps = {
  payments: Payment[];
  leads: Lead[];
  isAdmin: boolean;
  repId?: string;
};

export function MrrKpiCard({ payments, leads, isAdmin, repId }: MrrKpiCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const scopeRepId = isAdmin ? undefined : repId;

  const history = useMemo(
    () => buildMrrHistory(payments, leads, { repId: scopeRepId, months: 12 }),
    [payments, leads, scopeRepId],
  );
  const mrr = useMemo(() => currentMrr(history), [history]);
  const change = useMemo(() => mrrMonthOverMonthChange(history), [history]);

  return (
    <>
      <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {isAdmin ? "MRR" : "My MRR"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="w-3.5 h-3.5 mr-1" />
              History
            </Button>
            <DollarSign className="w-4 h-4 text-primary opacity-60 flex-shrink-0" />
          </div>
        </div>
        <div className="font-display text-2xl font-bold text-foreground">
          {formatClientLtvAmount(mrr.amount, mrr.currency)}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{mrr.label}</p>
        <ChangeBadge value={change} />
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>MRR History</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Monthly revenue from received payments (last 12 months)
          </p>
          <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
            {[...history].reverse().map((month) => (
              <div key={month.key} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{month.label}</span>
                <span className="font-semibold text-foreground">
                  {formatClientLtvAmount(month.amount, month.currency)}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
