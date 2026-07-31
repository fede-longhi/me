"use client";

import { Credentials } from "@/components/Credentials";
import { ExperienceList } from "@/components/ExperienceList";
import { Hero } from "@/components/Hero";
import { useLanguage } from "@/components/LanguageProvider";
import { ProjectList } from "@/components/ProjectList";
import { Section } from "@/components/Section";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export function SiteShell() {
  const { data } = useLanguage();
  const { ui } = data;

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
      </main>
      <SiteFooter contact={data.contact} name={data.home.name} />
    </div>
  );
}
