import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { RoleGate } from "@/components/auth/RoleGate";
import { Spinner } from "@/components/ui/spinner";
import { usePayments, usePaymentMutations, useDeals } from "@/hooks/queries";
import { formatDate } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";
import type { PaymentStatus } from "@/types";
import { DollarSign, Clock, AlertCircle, Plus, X } from "lucide-react";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200",
  REFUNDED: "bg-red-50 text-red-600 border-red-200",
};

const tabs = ["All Payments", "Pending", "Payment Log"];

export default function Payments() {
  const [activeTab, setActiveTab] = useState("All Payments");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ deal_id: "", invoice_ref: "", amount: "", method: "Bank Transfer", currency: "USD" as "USD" | "DZD" });
  const { formatMoney, convertAmount, displayCurrency } = useCurrency();

  const { data: payments = [], isLoading, isError } = usePayments();
  const { data: deals = [] } = useDeals();
  const { create } = usePaymentMutations();

  const totalReceived = payments.filter((p) => p.status === "RECEIVED").reduce((s, p) => s + convertAmount(p.amount, p.currency), 0);
  const pendingAmount = payments.filter((p) => p.status === "PENDING").reduce((s, p) => s + convertAmount(p.deal_value, p.currency), 0);
  const partialCount = payments.filter((p) => p.status === "PARTIAL").length;

  const displayPayments =
    activeTab === "All Payments"
      ? payments
      : activeTab === "Pending"
      ? payments.filter((p) => p.status === "PENDING" || p.status === "PARTIAL")
      : payments.filter((p) => p.status === "RECEIVED" || p.status === "REFUNDED");

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deal_id || !form.invoice_ref || !form.amount) return;
    await create.mutateAsync({
      deal_id: form.deal_id,
      invoice_ref: form.invoice_ref,
      amount: Number(form.amount),
      method: form.method,
      status: "RECEIVED",
      currency: form.currency,
    });
    setForm({ deal_id: "", invoice_ref: "", amount: "", method: "Bank Transfer", currency: displayCurrency });
    setShowForm(false);
  };

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Payments</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Revenue collection and tracking</p>
          </div>
          <RoleGate allowed={["admin"]}>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              data-testid="btn-record-payment"
            >
              <Plus className="w-4 h-4" />Record Payment
            </button>
          </RoleGate>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Received MTD</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {isLoading ? "—" : formatMoney(totalReceived)}
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending Amount</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {isLoading ? "—" : formatMoney(pendingAmount)}
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Partial Payments</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">
              {isLoading ? "—" : partialCount}
            </div>
          </div>
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

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-sm text-red-500">Failed to load payments.</div>
        ) : displayPayments.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground bg-card border border-card-border rounded-xl">
            No payments to display.
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left" data-testid="payments-table">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice Ref</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal Value</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Received</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Method</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-muted/40 transition-colors" data-testid={`payment-row-${payment.id}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{payment.invoice_ref}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{payment.company}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatMoney(payment.deal_value, payment.currency)}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {payment.amount > 0 ? formatMoney(payment.amount, payment.currency) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{payment.method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[payment.status]}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(payment.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-foreground">Record Payment</h2>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleRecordPayment} className="space-y-3">
                <select
                  required
                  value={form.deal_id}
                  onChange={(e) => setForm({ ...form, deal_id: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select deal...</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>{d.lead_name} — {d.company} ({formatMoney(d.value, d.currency)})</option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Invoice reference"
                  value={form.invoice_ref}
                  onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-2">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount received"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value as "USD" | "DZD" })}
                    className="w-24 px-2 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="USD">USD</option>
                    <option value="DZD">DZD</option>
                  </select>
                </div>
                <select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Check">Check</option>
                  <option value="Wire">Wire</option>
                  <option value="Other">Other</option>
                </select>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {create.isPending ? "Recording..." : "Record Payment"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
