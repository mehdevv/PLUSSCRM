import { formatCurrencyAmount, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import type { Client, Deal, Payment } from "@/types";

const COUNTED_STATUSES = new Set(["RECEIVED", "PARTIAL"]);

function norm(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function dealBelongsToClient(
  deal: Pick<Deal, "lead_id" | "company" | "stage" | "rep_id">,
  client: Pick<Client, "company" | "manager_id" | "email">,
  leadEmailById?: Map<string, string>,
): boolean {
  if (deal.stage !== "WON" || deal.rep_id !== client.manager_id) return false;

  const clientCompany = norm(client.company);
  const clientEmail = norm(client.email);
  if (clientCompany && norm(deal.company) === clientCompany) return true;

  if (clientEmail && leadEmailById) {
    const leadEmail = norm(leadEmailById.get(deal.lead_id));
    if (leadEmail && leadEmail === clientEmail) return true;
  }

  return false;
}

/** Won deal ids for a client (company / email match on rep's deals). */
export function wonDealIdsForClient(
  client: Pick<Client, "company" | "manager_id" | "email">,
  deals: Pick<Deal, "id" | "lead_id" | "company" | "stage" | "rep_id">[],
  leadEmailById?: Map<string, string>,
): Set<string> {
  return new Set(
    deals
      .filter((d) => dealBelongsToClient(d, client, leadEmailById))
      .map((d) => d.id),
  );
}

export function paymentsForClient<T extends Pick<Payment, "deal_id">>(
  client: Pick<Client, "company" | "manager_id" | "email">,
  deals: Pick<Deal, "id" | "lead_id" | "company" | "stage" | "rep_id">[],
  payments: T[],
  leadEmailById?: Map<string, string>,
): T[] {
  const dealById = new Map(deals.map((d) => [d.id, d]));
  return payments.filter((p) => {
    const deal = dealById.get(p.deal_id);
    return deal ? dealBelongsToClient(deal, client, leadEmailById) : false;
  });
}

/** Sum raw `payments.amount` values (no currency conversion). */
export function sumPaymentAmounts(
  payments: { amount: number; currency: string; status: string }[],
): { amount: number; currency: CurrencyCode } | null {
  const received = payments.filter((p) => COUNTED_STATUSES.has(p.status));
  if (received.length === 0) return null;

  const latest = received[received.length - 1];
  const currency: CurrencyCode = isCurrencyCode(latest.currency)
    ? latest.currency
    : "DZD";

  const amount = received.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  return { amount, currency };
}

/** LTV for display: sum of received payment amounts only (never stale client.ltv). */
export function resolveClientLtv(
  client: Client,
  deals: Pick<Deal, "id" | "lead_id" | "company" | "stage" | "rep_id">[],
  payments: Pick<Payment, "deal_id" | "amount" | "currency" | "status">[],
  leadEmailById?: Map<string, string>,
): { amount: number; currency: string } {
  const clientPayments = paymentsForClient(client, deals, payments, leadEmailById);
  const summed = sumPaymentAmounts(clientPayments);
  const currency = summed?.currency
    ?? (isCurrencyCode(client.currency) ? client.currency : "DZD");

  return {
    amount: summed?.amount ?? 0,
    currency,
  };
}

/** Sum payment-based LTV across clients (grouped by currency; prefers DZD). */
export function sumClientsLtv(
  clients: Client[],
  deals: Pick<Deal, "id" | "lead_id" | "company" | "stage" | "rep_id">[],
  payments: Pick<Payment, "deal_id" | "amount" | "currency" | "status">[],
  leadEmailById?: Map<string, string>,
): { amount: number; currency: CurrencyCode } {
  const byCurrency = new Map<CurrencyCode, number>();

  for (const client of clients) {
    const ltv = resolveClientLtv(client, deals, payments, leadEmailById);
    const code: CurrencyCode = isCurrencyCode(ltv.currency) ? ltv.currency : "DZD";
    byCurrency.set(code, (byCurrency.get(code) ?? 0) + ltv.amount);
  }

  if (byCurrency.has("DZD")) {
    return { amount: byCurrency.get("DZD")!, currency: "DZD" };
  }

  const entry = [...byCurrency.entries()][0];
  if (entry) return { amount: entry[1], currency: entry[0] };
  return { amount: 0, currency: "DZD" };
}

/** Show LTV in its stored/payment currency without converting to display currency. */
export function formatClientLtvAmount(amount: number, currency: string): string {
  const code: CurrencyCode = isCurrencyCode(currency) ? currency : "DZD";
  return formatCurrencyAmount(amount, code);
}
