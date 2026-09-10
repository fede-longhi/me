import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Admin — Fede Longhi",
};

export default function AdminLoginPage() {
  return (
    <div className="site-shell flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-md border border-line bg-surface/80 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green">
          Admin
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
          Entrar
        </h1>
        <p className="mt-2 mb-6 text-sm text-ink-muted">
          Administración del contenido del sitio.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
