"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

export function SiteNav() {
  const { data } = useLanguage();
  // Small screens collapse the links behind a toggle instead of wrapping.
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 max-[767px]:py-2.5 sm:px-8">
        <a
          href="/"
          className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight text-ink transition-colors hover:text-blue"
        >
          {data.home.name}
        </a>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 max-[767px]:hidden sm:gap-x-5">
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
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full border border-line text-ink-muted transition hover:border-blue hover:text-blue-deep min-[768px]:hidden"
          aria-expanded={menuOpen}
          aria-label={data.ui.navAria}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X size={17} strokeWidth={2} />
          ) : (
            <Menu size={17} strokeWidth={2} />
          )}
        </button>
      </div>
      {menuOpen ? (
        <div className="border-t border-line/70 bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] px-5 pb-3 pt-2 min-[768px]:hidden">
          <nav
            aria-label={data.ui.navAria}
            className="grid text-sm text-ink-muted"
          >
            {data.ui.nav.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="border-b border-line/60 py-2 transition-colors last:border-b-0 hover:text-ink"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
        </div>
      ) : null}
    </header>
  );
}
