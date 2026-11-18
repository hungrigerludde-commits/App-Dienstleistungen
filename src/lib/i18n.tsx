import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { de, en, type StringKey } from './strings';

export type Lang = 'de' | 'en';
const DICTS: Record<Lang, Record<StringKey, string>> = { de, en };
const STORAGE_KEY = 'app-language';

function deviceLanguage(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'de' ? 'de' : 'en';
  } catch {
    return 'de';
  }
}

export function translate(lang: Lang, key: StringKey, params?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.de[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
};
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLanguage());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => { if (v === 'de' || v === 'en') setLangState(v); });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);
  const t = useCallback((key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n muss innerhalb von <I18nProvider> verwendet werden');
  return ctx;
}

/** Wandelt Fehler (Supabase / Datenbank-Codes) in einen verständlichen Text um. */
export function errorMessage(t: Ctx['t'], err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  const code = /ERR_[A-Z0-9_]+(:[^\s]*)?/.exec(msg)?.[0];
  if (code) {
    const [key, a, b] = code.split(':');
    if (key in de) return t(key as StringKey, { a: a ?? '', b: b ?? '' });
  }
  if (msg.includes('Invalid login credentials')) return t('err_login');
  if (msg.includes('User already registered')) return t('err_registered');
  if (msg.includes('Email not confirmed')) return t('err_email_unconfirmed');
  if (msg.includes('Password should be')) return t('password_short');
  if (msg.includes('reports_one_open_per_pair')) return t('err_duplicate_report');
  if (msg.includes('row-level security')) return t('ERR_NOT_ALLOWED');
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) return t('err_network');
  return msg;
}
