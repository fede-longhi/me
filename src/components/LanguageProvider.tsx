"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LOCALE_STORAGE_KEY,
  LOCALES,
  type Locale,
  type LocalizedData,
  type SiteData,
} from "@/lib/types";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  data: SiteData;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "es";
}

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // ignore storage errors
  }

  const browser = window.navigator.language.toLowerCase();
  return browser.startsWith("es") ? "es" : "en";
}

type LanguageProviderProps = {
  catalog: LocalizedData;
  children: React.ReactNode;
};

export function LanguageProvider({ catalog, children }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore storage errors
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!LOCALES.includes(next)) return;
    setLocaleState(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      data: catalog[locale],
    }),
    [catalog, locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
