import type { AcademyItem } from "@/lib/types";

type AcademyListProps = {
  items: AcademyItem[];
};

export function AcademyList({ items }: AcademyListProps) {
  return (
    <ul className="space-y-0">
      {items.map((post) => (
        <li
          key={post.title}
          className="border-t border-line py-7 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
              {post.title}
            </h3>
            <time className="text-sm text-green">{post.date}</time>
          </div>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
            {post.summary}
          </p>
        </li>
      ))}
    </ul>
  );
}
