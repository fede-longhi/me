"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { LOCALE_LABELS, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/types";

export function LanguageSwitcher() {
  const { locale, setLocale, data } = useLanguage();

  return (
    <div
      role="group"
      aria-label={data.ui.langAria}
      className="inline-flex items-center border border-line text-xs font-semibold tracking-wide"
    >
      {LOCALES.map((code: Locale) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-label={LOCALE_NAMES[code]}
            onClick={() => setLocale(code)}
            aria-pressed={active}
            className={`group relative cursor-pointer px-2.5 py-1.5 transition-colors ${
              active
                ? "bg-blue-deep text-white"
                : "bg-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {LOCALE_LABELS[code]}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-50 -translate-x-1/2 whitespace-nowrap rounded-sm border border-line bg-[color-mix(in_oklab,var(--bg)_92%,white)] px-2.5 py-1.5 font-[family-name:var(--font-body)] text-[11px] font-semibold tracking-wide text-ink opacity-0 shadow-[0_8px_20px_color-mix(in_oklab,var(--blue-deep)_12%,transparent)] transition duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <span
                aria-hidden
                className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-line bg-[color-mix(in_oklab,var(--bg)_92%,white)]"
              />
              <span className="relative bg-gradient-to-r from-blue to-green bg-clip-text text-transparent">
                {LOCALE_NAMES[code]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
