"use client";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

export function SiteNav() {
  const { data } = useLanguage();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <a
          href="#home"
          className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight text-ink transition-colors hover:text-blue"
        >
          {data.home.name}
        </a>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:gap-x-5">
          <nav
            aria-label={data.ui.navAria}
            className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-ink-muted sm:gap-x-5"
          >
            {data.ui.nav.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative py-1 transition-colors hover:text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-green after:transition-transform hover:after:scale-x-100"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
