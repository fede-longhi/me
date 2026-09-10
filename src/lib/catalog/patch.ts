import type { Locale, LocalizedData, SiteData } from "@/lib/types";

export function patchLocale(
  catalog: LocalizedData,
  locale: Locale,
  patch: (data: SiteData) => SiteData,
): LocalizedData {
  return {
    ...catalog,
    [locale]: patch(catalog[locale]),
  };
}

export function patchBoth(
  catalog: LocalizedData,
  patch: (data: SiteData) => SiteData,
): LocalizedData {
  return {
    en: patch(catalog.en),
    es: patch(catalog.es),
  };
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

export function listLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function joinLines(items: string[] | undefined): string {
  return items?.join("\n") ?? "";
}
