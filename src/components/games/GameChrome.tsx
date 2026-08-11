"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

type GameChromeProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: React.ReactNode;
  wide?: boolean;
  /** Tighter header so the game stage can fit in the viewport. */
  compact?: boolean;
};

export function GameChrome({
  eyebrow,
  title,
  lead,
  children,
  wide = false,
  compact = false,
}: GameChromeProps) {
  const { data } = useLanguage();

  return (
    <div className="site-shell">
      <SiteNav />
      <main>
        <section className="border-b border-line">
          <div
            className={`mx-auto px-5 ${wide ? "max-w-7xl" : "max-w-6xl"} ${
              compact ? "py-5 sm:px-8 sm:py-6" : "py-12 sm:px-8 sm:py-16"
            }`}
          >
            <a
              href="/games"
              className="text-sm font-semibold text-blue-deep transition hover:text-blue"
            >
              ← {data.ui.backToGames}
            </a>
            <p
              className={`text-xs font-semibold uppercase tracking-[0.18em] text-green ${
                compact ? "mt-3" : "mt-6"
              }`}
            >
              {eyebrow}
            </p>
            <h1
              className={`font-[family-name:var(--font-display)] font-bold tracking-tight text-ink ${
                compact
                  ? "mt-2 text-2xl sm:text-3xl"
                  : "mt-3 text-3xl sm:text-4xl"
              }`}
            >
              {title}
            </h1>
            <p
              className={`max-w-2xl leading-relaxed text-ink-muted ${
                compact
                  ? "mt-2 text-sm sm:text-base"
                  : "mt-4 text-base sm:text-lg"
              }`}
            >
              {lead}
            </p>
            <div className={compact ? "mt-4" : "mt-10"}>{children}</div>
          </div>
        </section>
      </main>
      <SiteFooter
        contact={data.contact}
        name={data.home.name}
        languages={data.languages}
        languagesTitle={data.ui.languagesTitle}
      />
    </div>
  );
}
