import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { X, Upload, FileImage, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dealValueFromRow } from "@/lib/deal-value";
import { PAYMENT_METHODS } from "@/services/payments";
import type { Deal, Lead, PaymentStatus } from "@/types";
import type { WonDealPaymentInput } from "@/services/won-deal";

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "RECEIVED", label: "Received" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PENDING", label: "Pending" },
];

function defaultInvoiceRef(deal: Deal) {
  const stamp = format(new Date(), "yyyyMMdd");
  const slug = (deal.lead_name || deal.company || "deal")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 24);
  return `WON-${stamp}-${slug || deal.id.slice(0, 8)}`;
}

interface DealWonModalProps {
  deal: Deal | null;
  lead: Lead | null;
  open: boolean;
  busy?: boolean;
  formatMoney: (amount: number, currency?: string) => string;
  onClose: () => void;
  onSubmit: (payment: WonDealPaymentInput, files: File[]) => Promise<void>;
}

export function DealWonModal({
  deal,
  lead,
  open,
  busy,
  formatMoney,
  onClose,
  onSubmit,
}: DealWonModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recordPayment, setRecordPayment] = useState(true);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [status, setStatus] = useState<PaymentStatus>("RECEIVED");
  const [receivedAt, setReceivedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [currency, setCurrency] = useState<"USD" | "DZD">("USD");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open || !deal) return;
    const dealAmount = dealValueFromRow(deal.value);
    setRecordPayment(true);
    setInvoiceRef(defaultInvoiceRef(deal));
    setAmount(dealAmount > 0 ? String(dealAmount) : "");
    setMethod(PAYMENT_METHODS[0]);
    setStatus("RECEIVED");
    setReceivedAt(format(new Date(), "yyyy-MM-dd"));
    setCurrency((deal.currency as "USD" | "DZD") || "DZD");
    setNotes("");
    setFiles([]);
  }, [open, deal, lead]);

  if (!open || !deal || !lead) return null;

  const handleFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    setFiles((prev) => [...prev, ...Array.from(picked)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payment: WonDealPaymentInput = {
      recordPayment,
      invoice_ref: invoiceRef.trim() || defaultInvoiceRef(deal),
      amount: Number(amount) || 0,
      method,
      status,
      received_at: new Date(`${receivedAt}T12:00:00`).toISOString(),
      currency,
      notes: notes.trim() || undefined,
    };
    await onSubmit(payment, files);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Mark deal won</span>
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">{lead.company || deal.lead_name}</h2>
            <p className="text-sm text-muted-foreground">
              Deal value: {formatMoney(dealValueFromRow(deal.value), deal.currency)}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={recordPayment}
              onChange={(e) => setRecordPayment(e.target.checked)}
              className="rounded border-border"
            />
            Record payment received for this deal
          </label>

          {recordPayment && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Invoice / reference</label>
                  <input
                    required
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Invoice or transfer reference"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Amount received</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "USD" | "DZD")}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="USD">USD</option>
                    <option value="DZD">DZD</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Payment method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Payment date</label>
                  <input
                    type="date"
                    required
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Transfer details, bank name, etc."
                    className="mt-1 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Receipts & screenshots</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    <Upload className="w-3 h-3" /> Add files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {files.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                    Upload bank receipts, transfer screenshots, or signed invoices
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {files.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className="flex items-center gap-2 text-xs bg-background border border-border rounded-lg px-3 py-2">
                        <FileImage className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate text-foreground">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            The client will be created or updated in Clients. Payment details and uploaded files appear on the client profile.
          </p>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
              {busy ? "Saving…" : "Confirm won"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
