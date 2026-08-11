"use client";

import { GamesList } from "@/components/GamesList";
import { useLanguage } from "@/components/LanguageProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export function GamesPageShell() {
  const { data } = useLanguage();
  const { ui } = data;

  return (
    <div className="site-shell">
      <SiteNav />
      <main>
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">
              {ui.sections.gamesPage.eyebrow}
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {ui.sections.gamesPage.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              {ui.sections.gamesPage.lead}
            </p>
            <div className="mt-10">
              <GamesList
                items={data.games}
                openLabel={ui.openGame}
                emptyLabel={ui.gamesEmpty}
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter
        contact={data.contact}
        name={data.home.name}
        languages={data.languages}
        languagesTitle={ui.languagesTitle}
      />
    </div>
  );
}
