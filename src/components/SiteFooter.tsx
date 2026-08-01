import type { SiteData } from "@/lib/types";

type SiteFooterProps = {
  contact: SiteData["contact"];
  name: string;
  languages: SiteData["languages"];
  languagesTitle: string;
};

export function SiteFooter({
  contact,
  name,
  languages,
  languagesTitle,
}: SiteFooterProps) {
  return (
    <footer id="contact" className="scroll-mt-20 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
            {name}
          </p>
          <p className="mt-2 max-w-md text-sm text-ink-muted">{contact.note}</p>
          {contact.location ? (
            <p className="mt-3 text-sm text-ink-muted">{contact.location}</p>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="mt-3 inline-block cursor-pointer text-sm font-semibold text-blue hover:text-green"
            >
              {contact.email}
            </a>
          ) : null}
          {contact.links.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-4 text-sm font-medium text-ink-muted">
              {contact.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer hover:text-blue"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green">
            {languagesTitle}
          </p>
          <ul className="mt-4 space-y-2">
            {languages.map((lang) => (
              <li
                key={lang.name}
                className="flex items-baseline justify-between gap-4 border-b border-line/70 pb-2 text-sm last:border-b-0"
              >
                <span className="font-medium text-ink">{lang.name}</span>
                <span className="text-ink-muted">{lang.level}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
