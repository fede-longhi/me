import type { GameItem } from "@/lib/types";

type GamesListProps = {
  items: GameItem[];
  playLabel: string;
};

export function GamesList({ items, playLabel }: GamesListProps) {
  return (
    <ul className="grid gap-4">
      {items.map((game) => {
        const className =
          "group flex flex-col gap-2 border-l-2 border-green bg-surface/40 px-5 py-5 transition hover:bg-surface sm:flex-row sm:items-start sm:justify-between sm:gap-8";

        const body = (
          <>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink group-hover:text-blue-deep">
                {game.title}
              </h3>
              <p className="mt-1 text-sm text-blue">{game.engine}</p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
                {game.description}
              </p>
            </div>
            {game.link ? (
              <span className="shrink-0 text-sm font-semibold text-green underline-offset-4 group-hover:underline">
                {playLabel}
              </span>
            ) : null}
          </>
        );

        if (game.link) {
          return (
            <li key={game.title}>
              <a
                href={game.link}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {body}
              </a>
            </li>
          );
        }

        return (
          <li key={game.title} className={className}>
            {body}
          </li>
        );
      })}
    </ul>
  );
}
