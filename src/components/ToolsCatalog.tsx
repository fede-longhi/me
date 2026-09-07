"use client";

import { useMemo, useState } from "react";
import { ToolsList } from "@/components/ToolsList";
import type { ToolItem } from "@/lib/types";

type ToolsCatalogProps = {
  items: ToolItem[];
  openLabel: string;
  emptyLabel: string;
  searchPlaceholder: string;
  filterAllLabel: string;
  noMatchLabel: string;
};

function collectTags(items: ToolItem[]): string[] {
  const set = new Set<string>();
  for (const tool of items) {
    for (const tag of tool.tags ?? []) {
      const trimmed = tag.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function matchesQuery(tool: ToolItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    tool.name,
    tool.description,
    tool.category,
    ...(tool.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function matchesTags(tool: ToolItem, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const tags = new Set((tool.tags ?? []).map((t) => t.toLowerCase()));
  return selected.every((tag) => tags.has(tag.toLowerCase()));
}

export function ToolsCatalog({
  items,
  openLabel,
  emptyLabel,
  searchPlaceholder,
  filterAllLabel,
  noMatchLabel,
}: ToolsCatalogProps) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const allTags = useMemo(() => collectTags(items), [items]);
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      items.filter(
        (tool) =>
          matchesQuery(tool, normalizedQuery) &&
          matchesTags(tool, selectedTags),
      ),
    [items, normalizedQuery, selectedTags],
  );

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function clearFilters() {
    setQuery("");
    setSelectedTags([]);
  }

  if (items.length === 0) {
    return <ToolsList items={items} openLabel={openLabel} emptyLabel={emptyLabel} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <label className="block">
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full border border-line bg-white/70 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-blue"
          />
        </label>

        {allTags.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={filterAllLabel}>
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className={`px-3 py-1.5 text-xs font-bold tracking-wide transition ${
                selectedTags.length === 0
                  ? "bg-blue-deep text-white"
                  : "border border-line bg-white/70 text-ink hover:border-blue"
              }`}
            >
              {filterAllLabel}
            </button>
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-xs font-bold tracking-wide transition ${
                    active
                      ? "bg-green text-white"
                      : "border border-line bg-white/70 text-ink hover:border-green/60"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-line bg-surface/30 px-6 py-10 text-center">
          <p className="text-sm leading-relaxed text-ink-muted">{noMatchLabel}</p>
          {normalizedQuery || selectedTags.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-sm font-semibold text-blue-deep hover:text-blue"
            >
              {filterAllLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <ToolsList
          items={filtered}
          openLabel={openLabel}
          emptyLabel={emptyLabel}
        />
      )}
    </div>
  );
}
