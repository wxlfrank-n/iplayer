import { type ReactNode } from "react";
import { useAppSelector } from "../store/hooks";
import { I18nProvider } from "./I18nProvider";

/** Reads the configured UI locale from the store and drives I18nProvider. */
export function ConfiguredI18nProvider({ children }: { children: ReactNode }) {
  const language = useAppSelector((s) => s.config.language);
  return <I18nProvider locale={language}>{children}</I18nProvider>;
}