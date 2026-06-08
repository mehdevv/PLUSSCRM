import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAccounting } from "@/hooks/queries";
import { useCurrency } from "@/hooks/useCurrency";
import { FileDown, Package } from "lucide-react";
import { format, subMonths, startOfMonth, parseISO, isValid } from "date-fns";
import { downloadCSV, downloadJSON } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

const exportCards = [
  { title: "Revenue Journal", desc: "All invoiced revenue for the period", formats: ["XLSX", "PDF"], icon: "R" },
  { title: "Expense Ledger", desc: "Operating expenses and overheads", formats: ["XLSX", "PDF"], icon: "E" },
  { title: "Commission Statement", desc: "Rep commissions and payouts", formats: ["XLSX"], icon: "C" },
  { title: "P&L Summary", desc: "Full profit & loss report", formats: ["PDF"], icon: "P" },
  { title: "VAT Annex", desc: "VAT detail for all transactions", formats: ["XLSX"], icon: "V" },
  { title: "Full Package", desc: "All reports bundled together", formats: ["ZIP"], icon: "A" },
];

const PL_COLORS: Record<string, string> = {
  Revenue: "#10B981",
  Commissions: "#1A1AFF",
  Expenses: "#EF4444",
  "Net Profit": "#8B5CF6",
};

function buildMonthlyTrend(
  payments: { amount: number; currency?: string; received_at: string | null }[],
  expenses: { amount: number; expense_date: string }[],
  convertAmount: (amount: number, sourceCurrency?: string) => number,
) {
  const months = [2, 1, 0].map((offset) => {
    const d = startOfMonth(subMonths(new Date(), offset));
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM") };
  });

  return months.map(({ key, label }) => {
    const revenue = payments
      .filter((p) => p.received_at && format(parseISO(p.received_at), "yyyy-MM") === key)
      .reduce((s, p) => s + convertAmount(Number(p.amount), p.currency), 0);
    const expenseTotal = expenses
      .filter((e) => isValid(parseISO(e.expense_date)) && format(parseISO(e.expense_date), "yyyy-MM") === key)
      .reduce((s, e) => s + Number(e.amount), 0);
    return { month: label, revenue, expenses: expenseTotal, commissions: 0 };
  });
}

export default function Accounting() {
  const { data, isLoading } = useAccounting();
  const { toast } = useToast();
  const { formatMoney, convertAmount, displayCurrency } = useCurrency();

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Spinner className="size-8 text-primary" />
        </div>
      </Sidebar>
    );
  }

  const revenue = (data?.payments ?? []).reduce((s, p) => s + convertAmount(Number(p.amount), p.currency), 0);
  const commTotal = data?.commTotal ?? 0;
  const expenseTotal = data?.expenseTotal ?? 0;
  const net = revenue - expenseTotal - commTotal;
  const maxPl = Math.max(revenue, 1);

  const plData = [
    { label: "Revenue", value: revenue, color: PL_COLORS.Revenue },
    { label: "Commissions", value: commTotal, color: PL_COLORS.Commissions },
    { label: "Expenses", value: expenseTotal, color: PL_COLORS.Expenses },
    { label: "Net Profit", value: net, color: PL_COLORS["Net Profit"] },
  ];

  const monthlyData = buildMonthlyTrend(data?.payments ?? [], data?.expenses ?? [], convertAmount);
  const currentMonth = monthlyData[monthlyData.length - 1];
  if (currentMonth) currentMonth.commissions = commTotal;

  const marginPct = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
  const expensePct = revenue > 0 ? Math.round((expenseTotal / revenue) * 100) : 0;
  const avgCommRate = revenue > 0 ? Math.round((commTotal / revenue) * 100) : 0;

  const handleExport = (title: string, fmt: string) => {
    const slug = title.toLowerCase().replace(/\s/g, "-");
    const stamp = format(new Date(), "yyyy-MM-dd");

    if (title === "Revenue Journal") {
      const rows = (data?.payments ?? []).map((p) => ({
        amount: p.amount,
        status: p.status,
        received_at: p.received_at,
      }));
      if (fmt === "PDF") downloadJSON(`${slug}-${stamp}.json`, { title, rows, summary: { revenue } });
      else downloadCSV(`${slug}-${stamp}.csv`, rows);
    } else if (title === "Expense Ledger") {
      const rows = (data?.expenses ?? []).map((e) => ({
        category: e.category,
        amount: e.amount,
        expense_date: e.expense_date,
      }));
      if (fmt === "PDF") downloadJSON(`${slug}-${stamp}.json`, { title, rows, summary: { expenseTotal } });
      else downloadCSV(`${slug}-${stamp}.csv`, rows);
    } else if (title === "P&L Summary" || title === "Full Package") {
      downloadJSON(`${slug}-${stamp}.json`, {
        title,
        generatedAt: new Date().toISOString(),
        summary: { revenue, commTotal, expenseTotal, net, marginPct },
        payments: data?.payments ?? [],
        expenses: data?.expenses ?? [],
      });
    } else {
      downloadJSON(`${slug}-${stamp}.json`, { title, format: fmt, data });
    }
    toast({ title: "Export started", description: `${title} (${fmt}) downloaded.` });
  };

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Accounting</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Export center &amp; P&amp;L overview · {format(new Date(), "MMMM yyyy")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {plData.map((item) => (
            <div key={item.label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-muted-foreground font-medium mb-2">{item.label}</div>
              <div className="font-display text-xl font-bold" style={{ color: item.color }}>
                {formatMoney(item.value)}
              </div>
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(item.value / maxPl) * 100}%`, backgroundColor: item.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-4">3-Month P&amp;L Trend</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${displayCurrency === "DZD" ? "DA" : "$"}${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="commissions" name="Commissions" fill="#1A1AFF" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-500" />Revenue</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-primary" />Commissions</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-500" />Expenses</div>
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-4">{format(new Date(), "MMMM")} Breakdown</h2>
            <div className="space-y-4">
              {[
                { label: "Gross Revenue", value: formatMoney(revenue), sub: "From received payments" },
                { label: "Rep Commissions", value: formatMoney(commTotal), sub: `avg ${avgCommRate}% rate` },
                { label: "Operating Expenses", value: formatMoney(expenseTotal), sub: `${expensePct}% of revenue` },
                { label: "Net Profit", value: formatMoney(net), sub: `${marginPct}% margin` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium text-foreground">{row.label}</div>
                    <div className="text-xs text-muted-foreground">{row.sub}</div>
                  </div>
                  <div className="font-display font-bold text-foreground">{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-base font-bold mb-4">Export Center</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exportCards.map((card) => (
              <div key={card.title} className="bg-card border border-card-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow" data-testid={`export-${card.title.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-display font-bold text-lg">
                    {card.icon}
                  </div>
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="font-semibold text-sm text-foreground mb-1">{card.title}</div>
                <div className="text-xs text-muted-foreground mb-3">{card.desc}</div>
                <div className="flex items-center gap-2">
                  {card.formats.map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleExport(card.title, fmt)}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 border border-border rounded-lg hover:bg-muted hover:text-primary transition-colors"
                      data-testid={`btn-export-${card.title.toLowerCase().replace(/\s/g, "-")}-${fmt.toLowerCase()}`}
                    >
                      <FileDown className="w-3 h-3" />{fmt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
