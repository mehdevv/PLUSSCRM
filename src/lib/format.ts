import { formatDistanceToNow, format, parseISO, isValid } from "date-fns";

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, pattern);
  } catch {
    return dateStr;
  }
}

/** @deprecated Use useCurrency().formatMoney for display-currency aware formatting */
export function formatCurrency(amount: number, currency = "USD"): string {
  const locale = currency === "DZD" ? "fr-DZ" : "en-US";
  const digits = currency === "DZD" ? 2 : 0;
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
