import { useEffect, useState } from "react";
import type { Commission, CommissionStatus } from "@/types";
import { X } from "lucide-react";

interface CommissionEditModalProps {
  commission: Commission | null;
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (updates: { rate: number; amount: number; status: CommissionStatus }) => void;
}

export function CommissionEditModal({ commission, open, saving, onClose, onSave }: CommissionEditModalProps) {
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<CommissionStatus>("PENDING");

  useEffect(() => {
    if (commission && open) {
      setRate(String(commission.rate));
      setAmount(String(commission.amount));
      setStatus(commission.status);
    }
  }, [commission, open]);

  if (!open || !commission) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-foreground">Edit Commission</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{commission.rep_name} · {commission.deal_label}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ rate: Number(rate), amount: Number(amount), status });
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-xs text-muted-foreground">Rate (%)</span>
            <input required type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Amount</span>
            <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as CommissionStatus)} className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
            </select>
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
