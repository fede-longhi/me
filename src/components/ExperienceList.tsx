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
          className="grid gap-3 border-t border-line py-8 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-10"
        >
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              {item.role}
            </p>
            <p className="mt-1 text-sm font-medium text-blue">{item.company}</p>
            <p className="mt-2 text-sm text-ink-muted">{item.period}</p>
          </div>
          <p className="text-base leading-relaxed text-ink-muted">
            {item.description}
          </p>
        </li>
      ))}
    </ul>
  );
}
