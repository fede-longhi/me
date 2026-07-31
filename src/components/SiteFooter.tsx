import type { SiteData } from "@/lib/types";

type SiteFooterProps = {
  contact: SiteData["contact"];
  name: string;
};

export function SiteFooter({ contact, name }: SiteFooterProps) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
            {name}
          </p>
          <p className="mt-2 max-w-md text-sm text-ink-muted">{contact.note}</p>
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="mt-3 inline-block text-sm font-semibold text-blue hover:text-green"
            >
              {contact.email}
            </a>
          ) : null}
        </div>
        {contact.links.length > 0 ? (
          <ul className="flex flex-wrap gap-4 text-sm font-medium text-ink-muted">
            {contact.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </footer>
  );
}
