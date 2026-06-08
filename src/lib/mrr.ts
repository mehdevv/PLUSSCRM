import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";

const COUNTED_STATUSES = new Set(["RECEIVED", "PARTIAL"]);

export type MrrMonth = {
  key: string;
  label: string;
  amount: number;
  currency: CurrencyCode;
};

type MrrPayment = {
  amount: number;
  currency: string;
  status: string;
  received_at: string | null;
  deal_id: string;
};

type MrrDeal = { id: string; rep_id: string };

function eligiblePayments(
  payments: MrrPayment[],
  deals: MrrDeal[],
  repId?: string,
): MrrPayment[] {
  const dealRep = new Map(deals.map((d) => [d.id, d.rep_id]));
  return payments.filter((p) => {
    if (!COUNTED_STATUSES.has(p.status) || !p.received_at) return false;
    if (!repId) return true;
    return dealRep.get(p.deal_id) === repId;
  });
}

/** Last N calendar months of received payment totals (raw amounts, no conversion). */
export function buildMrrHistory(
  payments: MrrPayment[],
  deals: MrrDeal[],
  options?: { repId?: string; months?: number },
): MrrMonth[] {
  const months = options?.months ?? 12;
  const repId = options?.repId;
  const eligible = eligiblePayments(payments, deals, repId);
  const now = startOfMonth(new Date());

  const buckets = new Map<string, { amount: number; currency: CurrencyCode }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    buckets.set(format(d, "yyyy-MM"), { amount: 0, currency: "DZD" });
  }

  for (const p of eligible) {
    const key = format(parseISO(p.received_at!), "yyyy-MM");
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const currency: CurrencyCode = isCurrencyCode(p.currency) ? p.currency : "DZD";
    bucket.amount += Number(p.amount ?? 0);
    if (bucket.amount === Number(p.amount)) {
      bucket.currency = currency;
    } else if (currency === "DZD") {
      bucket.currency = "DZD";
    }
  }

  return [...buckets.entries()].map(([key, { amount, currency }]) => ({
    key,
    label: format(parseISO(`${key}-01`), "MMM yyyy"),
    amount,
    currency,
  }));
}

export function currentMrr(history: MrrMonth[]): MrrMonth {
  const key = format(startOfMonth(new Date()), "yyyy-MM");
  return history.find((m) => m.key === key) ?? { key, label: format(new Date(), "MMM yyyy"), amount: 0, currency: "DZD" };
}

export function mrrMonthOverMonthChange(history: MrrMonth[]): number | null {
  if (history.length < 2) return null;
  const curr = history[history.length - 1]?.amount ?? 0;
  const prev = history[history.length - 2]?.amount ?? 0;
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round((100 * (curr - prev)) / prev);
}
