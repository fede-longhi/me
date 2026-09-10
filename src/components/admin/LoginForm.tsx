"use client";

import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth-actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value="/admin" />
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full border border-line bg-white/80 px-3 py-2.5 text-sm text-ink outline-none focus:border-blue"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Contraseña
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full border border-line bg-white/80 px-3 py-2.5 text-sm text-ink outline-none focus:border-blue"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
