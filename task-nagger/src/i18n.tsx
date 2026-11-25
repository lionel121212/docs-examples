import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, Strings } from './locales/en';
import { he } from './locales/he';
import { ar } from './locales/ar';
import { ru } from './locales/ru';
import { es } from './locales/es';

export type Lang = 'he' | 'en' | 'ar' | 'ru' | 'es';
export type StrKey = keyof Strings;

export const LANGS: { code: Lang; name: string; flag: string; rtl: boolean; locale: string }[] = [
  { code: 'he', name: 'עברית', flag: '🇮🇱', rtl: true, locale: 'he-IL' },
  { code: 'en', name: 'English', flag: '🇺🇸', rtl: false, locale: 'en-US' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true, locale: 'ar' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', rtl: false, locale: 'ru-RU' },
  { code: 'es', name: 'Español', flag: '🇪🇸', rtl: false, locale: 'es-ES' },
];

const TABLES: Record<Lang, Strings> = { en, he, ar, ru, es };

/** Look up a string and fill {placeholders}. Falls back to English. */
export function translate(lang: Lang, key: StrKey, vars?: Record<string, string | number>): string {
  const raw = (TABLES[lang][key] ?? en[key]) as string;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : raw;
}

export function detectLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode ?? 'en';
    if (code === 'iw') return 'he';
    return (LANGS.find((l) => l.code === code)?.code ?? 'en') as Lang;
  } catch {
    return 'en';
  }
}

const LANG_KEY = 'lang';
export async function loadLang(): Promise<Lang | null> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    return v && v in TABLES ? (v as Lang) : null;
  } catch {
    return null;
  }
}

type Ctx = {
  lang: Lang;
  t: (key: StrKey, vars?: Record<string, string | number>) => string;
  rtl: boolean;
  dir: 'rtl' | 'ltr';
  locale: string;
  days: string[];
  setLang: (l: Lang) => void;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang());
  useEffect(() => {
    loadLang().then((l) => l && setLangState(l));
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => {
    const meta = LANGS.find((l) => l.code === lang)!;
    return {
      lang,
      t: (k, v) => translate(lang, k, v),
      rtl: meta.rtl,
      dir: meta.rtl ? 'rtl' : 'ltr',
      locale: meta.locale,
      days: TABLES[lang].days_short.split(','),
      setLang,
    };
  }, [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}
