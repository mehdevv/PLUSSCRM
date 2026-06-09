import { useEffect, useState } from "react";
import type { CompensationPlan } from "@/types";
import { X } from "lucide-react";

export type CompPlanFormValues = {
  name: string;
  base_rate: number;
  tier_multiplier: number;
  accelerator: number;
  cap: number | null;
};

interface CompPlanEditModalProps {
  plan: CompensationPlan | null;
  open: boolean;
  saving?: boolean;
  isNew?: boolean;
  onClose: () => void;
  onSave: (values: CompPlanFormValues) => void;
}

export function CompPlanEditModal({ plan, open, saving, isNew, onClose, onSave }: CompPlanEditModalProps) {
  const [name, setName] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [tierMultiplier, setTierMultiplier] = useState("");
  const [accelerator, setAccelerator] = useState("");
  const [cap, setCap] = useState("");

  useEffect(() => {
    if (open) {
      if (plan && !isNew) {
        setName(plan.name);
        setBaseRate(String(plan.base_rate));
        setTierMultiplier(String(plan.tier_multiplier));
        setAccelerator(String(plan.accelerator));
        setCap(plan.cap != null ? String(plan.cap) : "");
      } else {
        setName("");
        setBaseRate("10");
        setTierMultiplier("1");
        setAccelerator("1");
        setCap("");
      }
    }
  }, [plan, open, isNew]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-foreground">
            {isNew ? "New Compensation Plan" : "Edit Compensation Plan"}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              name: name.trim(),
              base_rate: Number(baseRate),
              tier_multiplier: Number(tierMultiplier),
              accelerator: Number(accelerator),
              cap: cap.trim() ? Number(cap) : null,
            });
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-xs text-muted-foreground">Plan name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Plan"
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Base commission rate (%)</span>
            <input
              required
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Tier multiplier</span>
              <input
                required
                type="number"
                min={0}
                step="0.1"
                value={tierMultiplier}
                onChange={(e) => setTierMultiplier(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Accelerator</span>
              <input
                required
                type="number"
                min={0}
                step="0.1"
                value={accelerator}
                onChange={(e) => setAccelerator(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground">Commission cap (optional)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="No cap"
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Used when deals are marked won. Reps on this plan earn base rate × deal value (with tier/accelerator rules).
          </p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create plan" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
