import { z } from "zod";

const linkSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().min(1),
  href: z.string().min(1),
});

const flagsSchema = z.object({
  tools: z.boolean(),
  games: z.boolean(),
});

const sectionCopySchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  lead: z.string(),
});

const siteDataSchema = z.object({
  flags: flagsSchema,
  ui: z.object({
    navAria: z.string(),
    langAria: z.string(),
    nav: z.array(linkSchema),
    sections: z.object({
      experience: sectionCopySchema,
      skills: sectionCopySchema,
      projects: sectionCopySchema,
      tools: sectionCopySchema,
      toolsPage: sectionCopySchema,
      games: sectionCopySchema,
      gamesPage: sectionCopySchema,
    }),
    heroVisual: z.string(),
    downloadCv: z.string(),
    openTool: z.string(),
    viewAllTools: z.string(),
    toolsEmpty: z.string(),
    toolsSearchPlaceholder: z.string(),
    toolsFilterAll: z.string(),
    toolsNoMatch: z.string(),
    backToTools: z.string(),
    openGame: z.string(),
    viewAllGames: z.string(),
    gamesEmpty: z.string(),
    backToGames: z.string(),
    visitSite: z.string(),
    certificationsTitle: z.string(),
    educationTitle: z.string(),
    languagesTitle: z.string(),
    highlightsLabel: z.string(),
    builtWithLabel: z.string(),
  }),
  home: z.object({
    name: z.string().min(1),
    headline: z.string().min(1),
    tagline: z.string().min(1),
    ctaPrimary: linkSchema,
    ctaSecondary: linkSchema,
    cvHref: z.string().min(1),
  }),
  experience: z.array(
    z.object({
      id: z.string().min(1),
      role: z.string().min(1),
      company: z.string().min(1),
      period: z.string().min(1),
      description: z.string().optional(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.array(
    z.object({
      id: z.string().min(1),
      group: z.string().min(1),
      items: z.array(z.string()),
    }),
  ),
  languages: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      level: z.string().min(1),
    }),
  ),
  education: z.array(
    z.object({
      id: z.string().min(1),
      school: z.string().min(1),
      period: z.string().min(1),
      degree: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  certifications: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      issuer: z.string().min(1),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      description: z.string().min(1),
      tech_stack: z.array(z.string()).optional(),
      link: z.string().nullable().optional(),
      slug: z.string().optional(),
      featured: z.boolean().optional(),
      published: z.boolean().optional(),
      status: z.string().optional(),
      highlights: z.array(z.string()).optional(),
      details: z.string().optional(),
      preview_image: z.string().nullable().optional(),
      preview_alt: z.string().optional(),
      link_label: z.string().optional(),
    }),
  ),
  tools: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().min(1),
      href: z.string().min(1),
      category: z.string().min(1),
      tags: z.array(z.string()).optional(),
      featured: z.boolean().optional(),
      published: z.boolean().optional(),
    }),
  ),
  games: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().min(1),
      href: z.string().min(1),
      category: z.string().min(1),
      featured: z.boolean().optional(),
      published: z.boolean().optional(),
    }),
  ),
  contact: z.object({
    note: z.string(),
    email: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    links: z.array(linkSchema),
  }),
});

export const localizedDataSchema = z.object({
  en: siteDataSchema,
  es: siteDataSchema,
});
