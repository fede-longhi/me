import type { ToolItem } from "@/lib/types";

type ToolsListProps = {
  items: ToolItem[];
  openLabel: string;
  emptyLabel: string;
};

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

export function ToolsList({ items, openLabel, emptyLabel }: ToolsListProps) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-line bg-surface/30 px-6 py-10 text-center">
        <p className="text-sm leading-relaxed text-ink-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((tool) => {
        const external = isExternal(tool.href);
        return (
          <li key={`${tool.name}-${tool.href}`}>
            <a
              href={tool.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="group flex h-full flex-col border border-line bg-surface/50 p-6 transition hover:border-green/50 hover:bg-surface"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink group-hover:text-blue-deep">
                  {tool.name}
                </h3>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-green">
                  {tool.category}
                </span>
              </div>
              {tool.tags && tool.tags.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {tool.tags.map((tag) => (
                    <li
                      key={tag}
                      className="border border-line/80 bg-white/50 px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-muted"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
                {tool.description}
              </p>
              <span className="mt-5 text-sm font-semibold text-blue underline-offset-4 group-hover:underline">
                {openLabel}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
