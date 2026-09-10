import type { GameItem } from "@/lib/types";

type GamesListProps = {
  items: GameItem[];
  openLabel: string;
  emptyLabel: string;
};

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

export function GamesList({ items, openLabel, emptyLabel }: GamesListProps) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-line bg-surface/30 px-6 py-10 text-center">
        <p className="text-sm leading-relaxed text-ink-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((game) => {
        const external = isExternal(game.href);
        return (
          <li key={game.id}>
            <a
              href={game.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="group flex h-full flex-col border border-ink/20 bg-white/85 p-6 transition hover:border-green/50 hover:bg-white"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink group-hover:text-blue-deep">
                  {game.name}
                </h3>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-green">
                  {game.category}
                </span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
                {game.description}
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
