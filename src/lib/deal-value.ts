/** Deal value from the deal record only (never inherit lead.value — leads often have bad import data). */
export function dealValueFromRow(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Won deals: prefer recorded payment over deal.value (payment is what the rep entered at close). */
export function wonDealDisplayAmount(
  deal: { value: number; currency: string },
  payment?: { amount: number; currency: string } | null,
): { amount: number; currency: string } {
  if (payment && payment.amount > 0) {
    return { amount: payment.amount, currency: payment.currency };
  }
  return { amount: dealValueFromRow(deal.value), currency: deal.currency };
}
