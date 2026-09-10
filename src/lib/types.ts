export type Locale = "en" | "es";

export type SiteLink = {
  id?: string;
  label: string;
  href: string;
};

export type SiteFlags = {
  tools: boolean;
  games: boolean;
};

export type ExperienceItem = {
  id: string;
  role: string;
  company: string;
  period: string;
  description?: string;
  bullets: string[];
};

export type SkillGroup = {
  id: string;
  group: string;
  items: string[];
};

export type LanguageItem = {
  id: string;
  name: string;
  level: string;
};

export type ProjectItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  tech_stack?: string[];
  link?: string | null;
  slug?: string;
  featured?: boolean;
  published?: boolean;
  status?: string;
  highlights?: string[];
  details?: string;
  preview_image?: string | null;
  preview_alt?: string;
  link_label?: string;
};

export type ToolItem = {
  id: string;
  name: string;
  description: string;
  href: string;
  category: string;
  /** Filter chips on /tools — same labels across locales when possible. */
  tags?: string[];
  /** When true, shown in the home Tools section. All published tools appear on /tools. */
  featured?: boolean;
  published?: boolean;
};

export type GameItem = {
  id: string;
  name: string;
  description: string;
  href: string;
  category: string;
  /** When true, shown in the home Games section. All published games appear on /games. */
  featured?: boolean;
  published?: boolean;
};

export type CertificationItem = {
  id: string;
  name: string;
  issuer: string;
};

export type EducationItem = {
  id: string;
  school: string;
  period: string;
  degree?: string;
  note?: string;
};

export type SectionCopy = {
  eyebrow: string;
  title: string;
  lead: string;
};

export type SiteUi = {
  navAria: string;
  langAria: string;
  nav: SiteLink[];
  sections: {
    experience: SectionCopy;
    skills: SectionCopy;
    projects: SectionCopy;
    tools: SectionCopy;
    toolsPage: SectionCopy;
    games: SectionCopy;
    gamesPage: SectionCopy;
  };
  heroVisual: string;
  downloadCv: string;
  openTool: string;
  viewAllTools: string;
  toolsEmpty: string;
  toolsSearchPlaceholder: string;
  toolsFilterAll: string;
  toolsNoMatch: string;
  backToTools: string;
  openGame: string;
  viewAllGames: string;
  gamesEmpty: string;
  backToGames: string;
  visitSite: string;
  certificationsTitle: string;
  educationTitle: string;
  languagesTitle: string;
  highlightsLabel: string;
  builtWithLabel: string;
};

export type SiteHome = {
  name: string;
  headline: string;
  tagline: string;
  ctaPrimary: SiteLink;
  ctaSecondary: SiteLink;
  cvHref: string;
};

export type SiteContact = {
  note: string;
  email?: string | null;
  location?: string | null;
  links: SiteLink[];
};

export type SiteData = {
  flags: SiteFlags;
  ui: SiteUi;
  home: SiteHome;
  experience: ExperienceItem[];
  skills: SkillGroup[];
  languages: LanguageItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  tools: ToolItem[];
  games: GameItem[];
  contact: SiteContact;
};

export type LocalizedData = Record<Locale, SiteData>;

export const LOCALES: Locale[] = ["en", "es"];
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};
export const LOCALE_STORAGE_KEY = "fede-locale";

export const DEFAULT_SITE_FLAGS: SiteFlags = {
  tools: true,
  games: true,
};

export function isPublished(item: { published?: boolean }): boolean {
  return item.published !== false;
}

export function isFeatured(item: { featured?: boolean }): boolean {
  return item.featured === true;
}
