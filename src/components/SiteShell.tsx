"use client";

import { Credentials } from "@/components/Credentials";
import { ExperienceList } from "@/components/ExperienceList";
import { Hero } from "@/components/Hero";
import { useLanguage } from "@/components/LanguageProvider";
import { ProjectList } from "@/components/ProjectList";
import { Section } from "@/components/Section";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { SkillsList } from "@/components/SkillsList";
import { ToolsList } from "@/components/ToolsList";

export function SiteShell() {
  const { data } = useLanguage();
  const { ui } = data;
  const featuredTools = data.tools.filter((tool) => tool.featured);

  return (
    <div className="site-shell">
      <SiteNav />
      <main>
        <Hero
          home={data.home}
          visualLabel={ui.heroVisual}
          downloadCvLabel={ui.downloadCv}
        />

        <Section
          id="experience"
          eyebrow={ui.sections.experience.eyebrow}
          title={ui.sections.experience.title}
          lead={ui.sections.experience.lead}
        >
          <ExperienceList items={data.experience} />
          <Credentials
            education={data.education}
            certifications={data.certifications}
            educationTitle={ui.educationTitle}
            certificationsTitle={ui.certificationsTitle}
          />
        </Section>

        <Section
          id="skills"
          eyebrow={ui.sections.skills.eyebrow}
          title={ui.sections.skills.title}
          lead={ui.sections.skills.lead}
        >
          <SkillsList groups={data.skills} />
        </Section>

        <Section
          id="projects"
          eyebrow={ui.sections.projects.eyebrow}
          title={ui.sections.projects.title}
          lead={ui.sections.projects.lead}
        >
          <ProjectList
            items={data.projects}
            highlightsLabel={ui.highlightsLabel}
            builtWithLabel={ui.builtWithLabel}
            visitSiteLabel={ui.visitSite}
          />
        </Section>

        <Section
          id="tools"
          eyebrow={ui.sections.tools.eyebrow}
          title={ui.sections.tools.title}
          lead={ui.sections.tools.lead}
        >
          <ToolsList
            items={featuredTools}
            openLabel={ui.openTool}
            emptyLabel={ui.toolsEmpty}
          />
          <div className="mt-8">
            <a
              href="/tools"
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold tracking-wide text-blue-deep transition hover:text-blue"
            >
              {ui.viewAllTools}
              <span aria-hidden className="text-xs">
                ↗
              </span>
            </a>
          </div>
        </Section>
      </main>
      <SiteFooter
        contact={data.contact}
        name={data.home.name}
        languages={data.languages}
        languagesTitle={ui.languagesTitle}
      />
    </div>
  );
}
