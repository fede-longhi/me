"use client";

import { useState, useTransition } from "react";
import { saveCatalogAction } from "@/lib/actions/catalog-actions";
import type { LocalizedData } from "@/lib/types";

export function useCatalogEditor(initial: LocalizedData) {
  const [catalog, setCatalog] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveCatalogAction(catalog);
      if (result.ok) {
        setMessage("Guardado.");
      } else {
        setError(result.error);
      }
    });
  }

  return { catalog, setCatalog, save, pending, message, error };
}

export const inputClass =
  "w-full border border-line bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-blue";

export const textareaClass = `${inputClass} min-h-24 resize-y`;

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-green"
      />
      {label}
    </label>
  );
}

export function LocaleTabs({
  locale,
  onChange,
}: {
  locale: "en" | "es";
  onChange: (locale: "en" | "es") => void;
}) {
  return (
    <div className="flex gap-1">
      {(["es", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`cursor-pointer px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
            locale === value
              ? "bg-ink text-white"
              : "border border-line text-ink-muted hover:text-ink"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export function AdminHeader({
  title,
  lead,
  onSave,
  pending,
  message,
  error,
}: {
  title: string;
  lead?: string;
  onSave: () => void;
  pending: boolean;
  message: string | null;
  error: string | null;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
          {title}
        </h1>
        {lead ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{lead}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-green">{message}</p> : null}
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="cursor-pointer bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-deep disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function cardClassName(index: number) {
  return `space-y-4 border border-ink/20 bg-white/90 p-5 ${index === 0 ? "" : ""}`;
}
