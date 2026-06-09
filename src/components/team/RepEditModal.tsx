import { useEffect, useState } from "react";
import type { CompensationPlan, Profile, RepTier } from "@/types";
import { X } from "lucide-react";

const TIERS: RepTier[] = ["BRONZE", "SILVER", "GOLD", "DIAMOND"];

interface RepEditModalProps {
  rep: Profile | null;
  open: boolean;
  saving?: boolean;
  compPlans: CompensationPlan[];
  currentPlanId?: string;
  onClose: () => void;
  onSave: (updates: {
    name: string;
    initials: string;
    color: string;
    tier: RepTier;
    vacation_mode: boolean;
    planId: string;
  }) => void;
}

export function RepEditModal({
  rep,
  open,
  saving,
  compPlans,
  currentPlanId,
  onClose,
  onSave,
}: RepEditModalProps) {
  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [tier, setTier] = useState<RepTier>("BRONZE");
  const [vacationMode, setVacationMode] = useState(false);
  const [planId, setPlanId] = useState("");

  useEffect(() => {
    if (rep && open) {
      setName(rep.name);
      setInitials(rep.initials);
      setColor(rep.color);
      setTier(rep.tier);
      setVacationMode(rep.vacation_mode);
      setPlanId(currentPlanId ?? compPlans[0]?.id ?? "");
    }
  }, [rep, open, currentPlanId, compPlans]);

  if (!open || !rep) return null;

  const selectedPlan = compPlans.find((p) => p.id === planId);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-foreground">Edit Rep</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{rep.email} — login email cannot be changed here.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!planId) return;
            onSave({
              name: name.trim(),
              initials: initials.trim(),
              color,
              tier,
              vacation_mode: vacationMode,
              planId,
            });
          }}
          className="space-y-3"
        >
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          <input required value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="Initials" maxLength={3} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded border border-border cursor-pointer" />
          </div>
          <select value={tier} onChange={(e) => setTier(e.target.value as RepTier)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Commission plan</label>
            <select
              required
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              data-testid="select-rep-comp-plan"
            >
              {compPlans.length === 0 ? (
                <option value="">No plans available</option>
              ) : (
                compPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.base_rate}%
                    {p.accelerator > 1 ? " + accelerator" : ""}
                  </option>
                ))
              )}
            </select>
            {selectedPlan && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Tier multiplier {selectedPlan.tier_multiplier}x · Accelerator {selectedPlan.accelerator}x
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={vacationMode} onChange={(e) => setVacationMode(e.target.checked)} className="accent-primary" />
            Vacation mode (skip in round-robin)
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving || !planId} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
