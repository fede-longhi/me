import type { SkillGroup } from "@/lib/types";

type SkillsListProps = {
  groups: SkillGroup[];
};

export function SkillsList({ groups }: SkillsListProps) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <li key={group.group} className="border-t border-line pt-4">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
            {group.group}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {group.items.join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
