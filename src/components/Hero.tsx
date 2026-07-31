import type { SiteData } from "@/lib/types";

type HeroProps = {
  home: SiteData["home"];
  visualLabel: string;
  downloadCvLabel: string;
};

export function Hero({ home, visualLabel, downloadCvLabel }: HeroProps) {
  return (
    <section
      id="home"
      className="relative min-h-[min(100svh,920px)] border-b border-line"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-orb absolute -right-24 top-16 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,color-mix(in_oklab,var(--blue)_55%,white),color-mix(in_oklab,var(--green)_45%,transparent)_55%,transparent_70%)] opacity-80 blur-2xl sm:right-0 sm:top-10" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:pb-28 lg:pt-28">
        <div>
          <p className="animate-rise overflow-visible pb-1 font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.08] tracking-tight text-ink sm:text-6xl md:text-7xl lg:text-8xl">
            {home.name}
          </p>
          <span
            aria-hidden
            className="hero-underline mt-4 block h-1 w-24 bg-gradient-to-r from-blue to-green"
          />
          <h1 className="animate-rise animate-rise-delay-1 mt-8 max-w-xl font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug text-blue-deep sm:text-3xl">
            {home.headline}
          </h1>
          <p className="animate-rise animate-rise-delay-2 mt-5 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
            {home.tagline}
          </p>
          <div className="animate-rise animate-rise-delay-3 mt-9 flex flex-wrap gap-3">
            <a
              href={home.ctaPrimary.href}
              className="inline-flex cursor-pointer items-center justify-center bg-blue-deep px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue"
            >
              {home.ctaPrimary.label}
            </a>
            <a
              href={home.ctaSecondary.href}
              className="inline-flex cursor-pointer items-center justify-center border border-ink/20 bg-surface/60 px-5 py-3 text-sm font-semibold text-ink transition hover:border-green hover:text-green"
            >
              {home.ctaSecondary.label}
            </a>
            <a
              href={home.cvHref}
              download
              className="inline-flex cursor-pointer items-center justify-center border border-blue/30 bg-transparent px-5 py-3 text-sm font-semibold text-blue transition hover:border-blue hover:bg-blue/5"
            >
              {downloadCvLabel}
            </a>
          </div>
        </div>

        <div
          aria-hidden
          className="animate-rise animate-rise-delay-2 relative hidden min-h-[280px] lg:block"
        >
          <div className="absolute inset-0 bg-[linear-gradient(145deg,color-mix(in_oklab,var(--blue)_18%,transparent),color-mix(in_oklab,var(--green)_22%,transparent))]" />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 480 420"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="48"
              y="56"
              width="280"
              height="300"
              stroke="currentColor"
              className="text-blue/50"
              strokeWidth="1.5"
            />
            <rect
              x="120"
              y="110"
              width="280"
              height="260"
              stroke="currentColor"
              className="text-green/60"
              strokeWidth="1.5"
            />
            <path
              d="M80 300 C140 220, 220 340, 300 250 C360 190, 400 210, 430 180"
              stroke="url(#heroStroke)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="300" cy="250" r="7" className="fill-green" />
            <circle cx="180" cy="270" r="4" className="fill-blue" />
            <text
              x="64"
              y="92"
              className="fill-ink-muted"
              style={{ fontFamily: "var(--font-body)", fontSize: "12px" }}
            >
              {visualLabel}
            </text>
            <defs>
              <linearGradient id="heroStroke" x1="80" y1="300" x2="430" y2="180">
                <stop stopColor="#1565a8" />
                <stop offset="1" stopColor="#1f8f6a" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </section>
  );
}
