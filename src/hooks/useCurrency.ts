import { useContext } from "react";
import { CurrencyContext, type CurrencyContextValue } from "@/contexts/CurrencyContext";
import {
  convertCurrency,
  formatCurrencyAmount,
  DEFAULT_USD_TO_DZD_RATE,
} from "@/lib/currency";

const fallback: CurrencyContextValue = {
  displayCurrency: "USD",
  usdToDzdRate: DEFAULT_USD_TO_DZD_RATE,
  convertAmount: (amount, sourceCurrency = "USD") =>
    convertCurrency(amount, sourceCurrency as "USD" | "DZD", "USD", DEFAULT_USD_TO_DZD_RATE),
  formatMoney: (amount, sourceCurrency) => {
    const converted = sourceCurrency
      ? convertCurrency(amount, sourceCurrency as "USD" | "DZD", "USD", DEFAULT_USD_TO_DZD_RATE)
      : amount;
    return formatCurrencyAmount(converted, "USD");
  },
};

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  return ctx ?? fallback;
}
