import {
  DEFAULT_SITE_FLAGS,
  LOCALES,
  type Locale,
  type LocalizedData,
  type SiteData,
  type SiteFlags,
  type SiteLink,
} from "@/lib/types";

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

function hrefId(href: string): string {
  const part = href.split("/").filter(Boolean).pop();
  return part ? slugify(part) : slugify(href);
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function ensureId(
  item: { id?: string },
  fallback: string,
  used: Set<string>,
): string {
  const raw = item.id?.trim();
  if (raw) {
    return uniqueId(slugify(raw), used);
  }
  return uniqueId(fallback, used);
}

function withLinkIds(links: SiteLink[]): SiteLink[] {
  const used = new Set<string>();
  return links.map((link) => ({
    ...link,
    id: ensureId(link, hrefId(link.href) || slugify(link.label), used),
  }));
}

function normalizeFlags(flags: Partial<SiteFlags> | undefined): SiteFlags {
  return {
    tools: flags?.tools !== false,
    games: flags?.games !== false,
  };
}

function normalizeLocale(data: SiteData, flags: SiteFlags): SiteData {
  const experienceIds = new Set<string>();
  const skillIds = new Set<string>();
  const languageIds = new Set<string>();
  const educationIds = new Set<string>();
  const certIds = new Set<string>();
  const projectIds = new Set<string>();
  const toolIds = new Set<string>();
  const gameIds = new Set<string>();

  return {
    ...data,
    flags,
    ui: {
      ...data.ui,
      nav: withLinkIds(data.ui.nav),
    },
    experience: data.experience.map((item) => ({
      ...item,
      id: ensureId(item, slugify(item.company), experienceIds),
    })),
    skills: data.skills.map((item) => ({
      ...item,
      id: ensureId(item, slugify(item.group), skillIds),
    })),
    languages: data.languages.map((item) => ({
      ...item,
      id: ensureId(item, slugify(item.name), languageIds),
    })),
    education: data.education.map((item) => ({
      ...item,
      id: ensureId(item, slugify(item.school), educationIds),
    })),
    certifications: data.certifications.map((item) => ({
      ...item,
      id: ensureId(item, slugify(item.name), certIds),
    })),
    projects: data.projects.map((item) => ({
      ...item,
      id: ensureId(item, slugify(item.slug || item.name), projectIds),
      published: item.published !== false,
    })),
    tools: data.tools.map((item) => ({
      ...item,
      id: ensureId(item, hrefId(item.href), toolIds),
      published: item.published !== false,
    })),
    games: data.games.map((item) => ({
      ...item,
      id: ensureId(item, hrefId(item.href), gameIds),
      published: item.published !== false,
    })),
    contact: {
      ...data.contact,
      links: withLinkIds(data.contact.links),
    },
  };
}

export function normalizeCatalog(raw: LocalizedData): LocalizedData {
  const flags = normalizeFlags(raw.en?.flags ?? raw.es?.flags);
  const catalog = {} as LocalizedData;
  for (const locale of LOCALES) {
    catalog[locale] = normalizeLocale(raw[locale], flags);
  }
  return catalog;
}

export function cloneCatalog(catalog: LocalizedData): LocalizedData {
  return structuredClone(catalog);
}

export function newItemId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${slugify(prefix)}-${rand}`;
}

export function localeOf(catalog: LocalizedData, locale: Locale): SiteData {
  return catalog[locale];
}
