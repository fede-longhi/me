import type { ArtItem } from "@/lib/types";

type ArtGridProps = {
  items: ArtItem[];
};

export function ArtGrid({ items }: ArtGridProps) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2">
      {items.map((piece) => (
        <li key={piece.title} className="overflow-hidden border border-line">
          <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,#0c3d6e,#1565a8_45%,#1f8f6a)]">
            {piece.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={piece.image_url}
                alt={piece.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-end p-5">
                <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-white/90">
                  {piece.type}
                </span>
              </div>
            )}
          </div>
          <div className="bg-surface/40 p-5">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
              {piece.title}
            </h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-blue">
              {piece.type}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {piece.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
