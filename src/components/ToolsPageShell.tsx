"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { ToolsList } from "@/components/ToolsList";

export function ToolsPageShell() {
  const { data } = useLanguage();
  const { ui } = data;

  return (
    <div className="site-shell">
      <SiteNav />
      <main>
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">
              {ui.sections.toolsPage.eyebrow}
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {ui.sections.toolsPage.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              {ui.sections.toolsPage.lead}
            </p>
            <div className="mt-10">
              <ToolsList
                items={data.tools}
                openLabel={ui.openTool}
                emptyLabel={ui.toolsEmpty}
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
