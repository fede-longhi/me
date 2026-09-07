export type Locale = "en" | "es";

export type SiteLink = {
  label: string;
  href: string;
};

export type ExperienceItem = {
  role: string;
  company: string;
  period: string;
  description?: string;
  bullets: string[];
};

export type SkillGroup = {
  group: string;
  items: string[];
};

export type LanguageItem = {
  name: string;
  level: string;
};

export type ProjectItem = {
  name: string;
  category: string;
  description: string;
  tech_stack?: string[];
  link?: string | null;
  slug?: string;
  featured?: boolean;
  status?: string;
  highlights?: string[];
  details?: string;
  preview_image?: string | null;
  preview_alt?: string;
  link_label?: string;
};

export type ToolItem = {
  name: string;
  description: string;
  href: string;
  category: string;
  /** Filter chips on /tools — same labels across locales when possible. */
  tags?: string[];
  /** When true, shown in the home Tools section. All tools appear on /tools. */
  featured?: boolean;
};

export type GameItem = {
  name: string;
  description: string;
  href: string;
  category: string;
  /** When true, shown in the home Games section. All games appear on /games. */
  featured?: boolean;
};

export type CertificationItem = {
  name: string;
  issuer: string;
};

export type EducationItem = {
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

export type SiteData = {
  ui: SiteUi;
  home: {
    name: string;
    headline: string;
    tagline: string;
    ctaPrimary: SiteLink;
    ctaSecondary: SiteLink;
    cvHref: string;
  };
  experience: ExperienceItem[];
  skills: SkillGroup[];
  languages: LanguageItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  tools: ToolItem[];
  games: GameItem[];
  contact: {
    note: string;
    email?: string | null;
    location?: string | null;
    links: SiteLink[];
  };
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
