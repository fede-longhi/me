import type { ProjectItem } from "@/lib/types";

type ProjectListProps = {
  items: ProjectItem[];
  highlightsLabel: string;
  builtWithLabel: string;
  visitSiteLabel: string;
};

export function ProjectList({
  items,
  highlightsLabel,
  builtWithLabel,
  visitSiteLabel,
}: ProjectListProps) {
  const featured = items.filter((project) => project.featured);
  const rest = items.filter((project) => !project.featured);

  return (
    <div className="space-y-6">
      {featured.map((project) => (
        <article
          key={project.name}
          id={project.slug ?? project.name.toLowerCase()}
          className="scroll-mt-24 border border-line bg-surface/50 p-6 sm:p-8"
        >
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
                  {project.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-wider">
                  <span className="text-green">{project.category}</span>
                  {project.status ? (
                    <span className="text-blue">{project.status}</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-muted">
                {project.description}
              </p>
              {project.details ? (
                <div className="mt-5 max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green">
                    {builtWithLabel}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {project.details}
                  </p>
                </div>
              ) : null}
              {project.highlights?.length ? (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green">
                    {highlightsLabel}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {project.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-sm leading-relaxed text-ink-muted"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {project.tech_stack?.length ? (
                <p className="mt-6 text-xs tracking-wide text-ink-muted/90">
                  {project.tech_stack.join(" · ")}
                </p>
              ) : null}
              {project.link ? (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue transition hover:text-green"
                >
                  {project.link_label ?? visitSiteLabel}
                  <span aria-hidden className="text-xs">
                    ↗
                  </span>
                </a>
              ) : null}
            </div>

            {project.preview_image ? (
              <a
                href={project.link ?? project.preview_image}
                target={project.link ? "_blank" : undefined}
                rel={project.link ? "noopener noreferrer" : undefined}
                className="group block overflow-hidden border border-line bg-ink/5 transition hover:border-blue/40"
                aria-label={
                  project.link
                    ? `${visitSiteLabel}: ${project.name}`
                    : project.preview_alt ?? project.name
                }
              >
                <div className="flex items-center gap-1.5 border-b border-line bg-surface px-3 py-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full bg-[#e57373]"
                  />
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full bg-[#ffd54f]"
                  />
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full bg-[#81c784]"
                  />
                  <span className="ml-2 truncate text-[11px] text-ink-muted">
                    {project.link
                      ? project.link.replace(/^https?:\/\//, "")
                      : project.name}
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.preview_image}
                  alt={project.preview_alt ?? project.name}
                  className="aspect-[16/10] w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                />
              </a>
            ) : null}
          </div>
        </article>
      ))}

      {rest.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rest.map((project) => {
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink group-hover:text-blue-deep">
                    {project.name}
                  </h3>
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-green">
                    {project.category}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  {project.description}
                </p>
                {project.tech_stack?.length ? (
                  <p className="mt-4 text-xs tracking-wide text-ink-muted/90">
                    {project.tech_stack.join(" · ")}
                  </p>
                ) : null}
              </>
            );

            const className =
              "group block border border-line bg-surface/50 p-6 transition hover:border-blue/40 hover:bg-surface";

            if (project.link) {
              return (
                <li key={project.name}>
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {inner}
                  </a>
                </li>
              );
            }

            return (
              <li key={project.name} className={className}>
                {inner}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
