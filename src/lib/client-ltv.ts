import { formatCurrencyAmount, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import type { Client, Lead, Payment } from "@/types";

const COUNTED_STATUSES = new Set(["RECEIVED", "PARTIAL"]);

function norm(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function leadBelongsToClient(
  lead: Pick<Lead, "id" | "company" | "email" | "assigned_to">,
  client: Pick<Client, "company" | "manager_id" | "email">,
): boolean {
  if (lead.assigned_to !== client.manager_id) return false;

  const clientCompany = norm(client.company);
  const leadCompany = norm(lead.company);
  if (clientCompany && leadCompany && clientCompany === leadCompany) return true;

  const clientEmail = norm(client.email);
  const leadEmail = norm(lead.email);
  return Boolean(clientEmail && leadEmail && clientEmail === leadEmail);
}

export function clientLeadIds(
  client: Pick<Client, "company" | "manager_id" | "email">,
  leads: Pick<Lead, "id" | "company" | "email" | "assigned_to">[],
): Set<string> {
  return new Set(
    leads.filter((l) => leadBelongsToClient(l, client)).map((l) => l.id),
  );
}

export function paymentsForClient<T extends Pick<Payment, "lead_id">>(
  client: Pick<Client, "company" | "manager_id" | "email">,
  leads: Pick<Lead, "id" | "company" | "email" | "assigned_to">[],
  payments: T[],
): T[] {
  const ids = clientLeadIds(client, leads);
  return payments.filter((p) => ids.has(p.lead_id));
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

/** LTV for display: sum of received payment amounts for the client's pipeline leads. */
export function resolveClientLtv(
  client: Client,
  leads: Pick<Lead, "id" | "company" | "email" | "assigned_to">[],
  payments: Pick<Payment, "lead_id" | "amount" | "currency" | "status">[],
): { amount: number; currency: string } {
  const clientPayments = paymentsForClient(client, leads, payments);
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
  leads: Pick<Lead, "id" | "company" | "email" | "assigned_to">[],
  payments: Pick<Payment, "lead_id" | "amount" | "currency" | "status">[],
): { amount: number; currency: CurrencyCode } {
  const byCurrency = new Map<CurrencyCode, number>();

  for (const client of clients) {
    const ltv = resolveClientLtv(client, leads, payments);
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

/** Clients with no recorded revenue (LTV ≤ 0) are removed automatically. */
export function shouldPruneZeroLtvClient(
  client: Pick<Client, "company" | "manager_id" | "email" | "ltv">,
  leads: Pick<Lead, "id" | "company" | "email" | "assigned_to">[],
  payments: Pick<Payment, "lead_id" | "amount" | "currency" | "status">[],
): boolean {
  return resolveClientLtv(client as Client, leads, payments).amount <= 0;
}

/** Show LTV in its stored/payment currency without converting to display currency. */
export function formatClientLtvAmount(amount: number, currency: string): string {
  const code: CurrencyCode = isCurrencyCode(currency) ? currency : "DZD";
  return formatCurrencyAmount(amount, code);
}
