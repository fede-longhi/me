import { logout } from "@/lib/actions/auth-actions";

const NAV = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/home", label: "Home" },
  { href: "/admin/experience", label: "Experiencia" },
  { href: "/admin/credentials", label: "Credenciales" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/projects", label: "Proyectos" },
  { href: "/admin/catalog", label: "Tools y games" },
  { href: "/admin/contact", label: "Contacto" },
];

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell min-h-screen">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">
              Admin
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-lg font-bold text-ink">
              Fede Longhi
            </p>
            <p className="mt-1 truncate text-xs text-ink-muted">{email}</p>
          </div>
          <nav className="space-y-1 text-sm">
            {NAV.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block border border-transparent px-3 py-2 text-ink-muted transition hover:border-line hover:bg-surface hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <form action={logout}>
            <button
              type="submit"
              className="cursor-pointer text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Salir
            </button>
          </form>
          <a
            href="/"
            className="block text-sm text-blue hover:text-blue-deep"
          >
            Ver sitio →
          </a>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
