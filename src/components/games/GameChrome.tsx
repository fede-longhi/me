"use client";

import { Info } from "lucide-react";
import { useState } from "react";
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
  // On small screens the lead is folded away so the stage gets the height.
  const [leadOpen, setLeadOpen] = useState(false);

  return (
    <div className="site-shell">
      <SiteNav />
      <main>
        <section className="border-b border-line">
          <div
            className={`mx-auto px-5 ${wide ? "max-w-7xl" : "max-w-6xl"} ${
              compact
                ? "py-5 max-[767px]:py-3 sm:px-8 sm:py-6"
                : "py-12 sm:px-8 sm:py-16"
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
                compact ? "mt-3 max-[767px]:mt-2" : "mt-6"
              }`}
            >
              {eyebrow}
            </p>
            <div className="flex items-start justify-between gap-3">
              <h1
                className={`font-[family-name:var(--font-display)] font-bold tracking-tight text-ink ${
                  compact
                    ? "mt-2 text-2xl max-[767px]:mt-1 max-[767px]:text-xl sm:text-3xl"
                    : "mt-3 text-3xl sm:text-4xl"
                }`}
              >
                {title}
              </h1>
              {compact ? (
                <button
                  type="button"
                  className="mt-1 grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition hover:border-blue hover:text-blue-deep min-[768px]:hidden"
                  aria-expanded={leadOpen}
                  aria-label={
                    leadOpen ? data.ui.hideDetails : data.ui.showDetails
                  }
                  onClick={() => setLeadOpen((open) => !open)}
                >
                  <Info size={16} strokeWidth={2} />
                </button>
              ) : null}
            </div>
            <p
              className={`max-w-2xl leading-relaxed text-ink-muted ${
                compact
                  ? `mt-2 text-sm sm:text-base ${
                      leadOpen
                        ? "max-[767px]:mt-1.5 max-[767px]:text-xs"
                        : "max-[767px]:hidden"
                    }`
                  : "mt-4 text-base sm:text-lg"
              }`}
            >
              {lead}
            </p>
            <div
              className={
                compact ? "mt-4 max-[767px]:mt-2" : "mt-10"
              }
            >
              {children}
            </div>
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
