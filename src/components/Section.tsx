type SectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
};

export function Section({ id, eyebrow, title, lead, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {title}
          </h2>
          {lead ? (
            <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">
              {lead}
            </p>
          ) : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
