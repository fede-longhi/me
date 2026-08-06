"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

type ToolChromeProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: React.ReactNode;
  wide?: boolean;
};

export function ToolChrome({
  eyebrow,
  title,
  lead,
  children,
  wide = false,
}: ToolChromeProps) {
  const { data } = useLanguage();

  return (
    <div className="site-shell">
      <SiteNav />
      <main>
        <section className="border-b border-line">
          <div
            className={`mx-auto px-5 py-12 sm:px-8 sm:py-16 ${wide ? "max-w-7xl" : "max-w-6xl"}`}
          >
            <a
              href="/tools"
              className="text-sm font-semibold text-blue-deep transition hover:text-blue"
            >
              ← {data.ui.backToTools}
            </a>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-green">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              {lead}
            </p>
            <div className="mt-10">{children}</div>
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
