import { useLayoutEffect, useMemo, type ReactNode } from "react";
import { dictionaryFor } from "./translations";
import { I18nContext, setLocale } from "./useI18n";

export interface I18nProviderProps {
  locale?: string;
  children: ReactNode;
}

/** Provides the active message dictionary to `useT()` consumers. */
export function I18nProvider({ locale = "en", children }: I18nProviderProps) {
  const messages = dictionaryFor(locale);
  const value = useMemo(() => messages, [messages]);
  useLayoutEffect(() => {
    setLocale(locale);
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}