import { getSiteCatalog } from "@/lib/catalog";
import { isFeatured, isPublished } from "@/lib/types";

export default async function AdminHomePage() {
  const catalog = await getSiteCatalog();
  const { flags, tools, games, projects, experience, certifications } =
    catalog.es;

  const publishedTools = tools.filter(isPublished);
  const featuredTools = publishedTools.filter(isFeatured);
  const publishedGames = games.filter(isPublished);
  const featuredGames = publishedGames.filter(isFeatured);
  const publishedProjects = projects.filter(isPublished);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
        Inicio
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Qué está visible en el sitio público ahora mismo.
      </p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <Stat
          label="Tools"
          value={flags.tools ? "sección on" : "sección off"}
          detail={`${featuredTools.length} en home · ${publishedTools.length} publicadas`}
        />
        <Stat
          label="Games"
          value={flags.games ? "sección on" : "sección off"}
          detail={`${featuredGames.length} en home · ${publishedGames.length} publicados`}
        />
        <Stat
          label="Proyectos"
          value={`${publishedProjects.length} publicados`}
          detail={`${projects.filter(isFeatured).length} featured`}
        />
        <Stat
          label="Experiencia"
          value={`${experience.length} puestos`}
          detail={`${certifications.length} certificaciones`}
        />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-ink/20 bg-white/90 p-5">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-green">
        {label}
      </dt>
      <dd className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
        {value}
      </dd>
      <p className="mt-1 text-sm text-ink-muted">{detail}</p>
    </div>
  );
}
