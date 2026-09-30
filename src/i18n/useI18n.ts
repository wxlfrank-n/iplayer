import {createContext, useCallback, useContext} from 'react';
import {
  dictionaryFor,
  isLocale,
  translate,
  en,
  type LocaleId,
  type Messages,
  type TranslationKey,
  type TranslationParams,
} from './translations';

export type {Messages, TranslationKey, TranslationParams, LocaleId};

export const I18nContext = createContext<Messages>(en);

export type T = (key: TranslationKey, params?: TranslationParams) => string;

let currentLocale: LocaleId = 'en';

export function getLocale(): LocaleId {
  return currentLocale;
}

/** Switches the module-level locale used by the non-React `t()` helper. */
export function setLocale(locale: string): void {
  currentLocale = isLocale(locale) ? locale : 'en';
}

/** Reactive translation function for function components. */
export function useT(): T {
  const messages = useContext(I18nContext);
  return useCallback<T>(
    (key, params) => translate(messages, key, params),
    [messages],
  );
}

/** Non-React translation helper (class components, plain callbacks). */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(dictionaryFor(currentLocale), key, params);
}
