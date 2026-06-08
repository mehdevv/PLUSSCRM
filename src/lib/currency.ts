export const SUPPORTED_CURRENCIES = ["USD", "DZD"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_USD_TO_DZD_RATE = 134;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  usdToDzdRate: number,
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  const rate = usdToDzdRate > 0 ? usdToDzdRate : DEFAULT_USD_TO_DZD_RATE;
  if (from === "USD" && to === "DZD") return amount * rate;
  if (from === "DZD" && to === "USD") return amount / rate;
  return amount;
}

export function formatCurrencyAmount(amount: number, currency: CurrencyCode): string {
  const locale = currency === "DZD" ? "fr-DZ" : "en-US";
  const fractionDigits = currency === "DZD" ? 2 : 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
