import { createContext, useCallback, useMemo, type ReactNode } from "react";
import { useSettings } from "@/hooks/queries";
import {
  convertCurrency,
  formatCurrencyAmount,
  DEFAULT_USD_TO_DZD_RATE,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency";

export interface CurrencyContextValue {
  displayCurrency: CurrencyCode;
  usdToDzdRate: number;
  convertAmount: (amount: number, sourceCurrency?: string) => number;
  formatMoney: (amount: number, sourceCurrency?: string) => string;
}

export const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();

  const displayCurrency: CurrencyCode =
    settings?.currency && isCurrencyCode(settings.currency) ? settings.currency : "USD";

  const usdToDzdRate = settings?.usd_to_dzd_rate ?? DEFAULT_USD_TO_DZD_RATE;

  const convertAmount = useCallback(
    (amount: number, sourceCurrency = "USD") => {
      const from = isCurrencyCode(sourceCurrency) ? sourceCurrency : "USD";
      return convertCurrency(amount, from, displayCurrency, usdToDzdRate);
    },
    [displayCurrency, usdToDzdRate],
  );

  const formatMoney = useCallback(
    (amount: number, sourceCurrency?: string) => {
      const converted = sourceCurrency != null
        ? convertAmount(amount, sourceCurrency)
        : amount;
      return formatCurrencyAmount(converted, displayCurrency);
    },
    [convertAmount, displayCurrency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ displayCurrency, usdToDzdRate, convertAmount, formatMoney }),
    [displayCurrency, usdToDzdRate, convertAmount, formatMoney],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
