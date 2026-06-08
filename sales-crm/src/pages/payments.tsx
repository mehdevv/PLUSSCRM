import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { mockPayments, type PaymentStatus } from "@/lib/mock-data";
import { DollarSign, Clock, AlertCircle, Plus } from "lucide-react";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  RECEIVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200",
  REFUNDED: "bg-red-50 text-red-600 border-red-200",
};

const tabs = ["All Payments", "Pending", "Payment Log"];

export default function Payments() {
  const [activeTab, setActiveTab] = useState("All Payments");

  const totalReceived = mockPayments.filter((p) => p.status === "RECEIVED").reduce((s, p) => s + p.amount, 0);
  const pendingAmount = mockPayments.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.dealValue, 0);
  const partialCount = mockPayments.filter((p) => p.status === "PARTIAL").length;

  const displayPayments =
    activeTab === "All Payments"
      ? mockPayments
      : activeTab === "Pending"
      ? mockPayments.filter((p) => p.status === "PENDING" || p.status === "PARTIAL")
      : mockPayments.filter((p) => p.status === "RECEIVED" || p.status === "REFUNDED");

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Payments</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Revenue collection and tracking</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-record-payment">
            <Plus className="w-4 h-4" />Record Payment
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Received MTD</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">${totalReceived.toLocaleString()}</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending Amount</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">${pendingAmount.toLocaleString()}</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Partial Payments</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">{partialCount}</div>
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
                  <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{payment.invoiceRef}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{payment.company}</td>
                  <td className="px-4 py-3 text-muted-foreground">${payment.dealValue.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {payment.amount > 0 ? `$${payment.amount.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{payment.method}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[payment.status]}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{payment.receivedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Sidebar>
  );
}
