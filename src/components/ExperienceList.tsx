import type { ExperienceItem } from "@/lib/types";

type ExperienceListProps = {
  items: ExperienceItem[];
};

export function ExperienceList({ items }: ExperienceListProps) {
  return (
    <ul className="space-y-0">
      {items.map((item) => (
        <li
          key={`${item.role}-${item.company}`}
          className="grid gap-4 border-t border-line py-8 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)] sm:gap-10"
        >
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              {item.role}
            </p>
            <p className="mt-1 text-sm font-medium text-blue">{item.company}</p>
            <p className="mt-2 text-sm text-ink-muted">{item.period}</p>
          </div>
          <div>
            {item.description ? (
              <p className="text-sm leading-relaxed text-ink-muted">
                {item.description}
              </p>
            ) : null}
            <ul className={`${item.description ? "mt-4" : ""} space-y-2.5`}>
              {item.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 text-sm leading-relaxed text-ink-muted sm:text-base"
                >
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
