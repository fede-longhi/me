"use client";

import { useEffect, useMemo, useState } from "react";
import type { LocaleLabel } from "@/lib/roguelike/content";

type ArtFile = {
  src: string;
  name: string;
  folder: string;
};

export function BeastPathArtPicker({
  labels,
  value,
  onChange,
  label,
}: {
  labels: LocaleLabel;
  value: string;
  onChange: (src: string) => void;
  label?: string;
}) {
  const [images, setImages] = useState<ArtFile[]>([]);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("all");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/beast-path/art")
      .then(async (res) => {
        if (!res.ok) throw new Error("art list failed");
        return (await res.json()) as { images?: ArtFile[] };
      })
      .then((data) => {
        if (cancelled) return;
        setImages(data.images ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const folders = useMemo(() => {
    const set = new Set(images.map((img) => img.folder));
    return [...set].sort();
  }, [images]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return images.filter((img) => {
      if (folder !== "all" && img.folder !== folder) return false;
      if (!q) return true;
      return (
        img.name.toLowerCase().includes(q) ||
        img.folder.toLowerCase().includes(q) ||
        img.src.toLowerCase().includes(q)
      );
    });
  }, [images, query, folder]);

  return (
    <div className="mt-2">
      <p className="text-[11px] text-[var(--bp-muted)]">
        {label ?? labels.ui.contentArt}
      </p>
      <input
        type="text"
        className="mt-0.5 w-full border border-[var(--bp-line)] bg-black/25 px-2 py-1 text-[11px] text-[var(--bp-ink)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={labels.ui.contentArtPath}
      />
      <div className="mt-1 flex flex-wrap gap-1">
        <input
          type="search"
          className="min-w-[8rem] flex-1 border border-[var(--bp-line)] bg-black/25 px-2 py-1 text-[11px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.ui.contentArtSearch}
        />
        <select
          className="border border-[var(--bp-line)] bg-black/25 px-2 py-1 text-[11px]"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          <option value="all">{labels.ui.contentArtAllFolders}</option>
          {folders.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {value ? (
          <button
            type="button"
            className="beast-path__btn-ghost px-2 py-1 text-[10px]"
            onClick={() => onChange("")}
          >
            {labels.ui.contentArtClear}
          </button>
        ) : null}
      </div>
      <div className="beast-path__art-picker mt-1">
        {status === "loading" ? (
          <p className="px-2 py-3 text-[10px] text-[var(--bp-muted)]">
            {labels.ui.contentArtLoading}
          </p>
        ) : status === "error" ? (
          <p className="px-2 py-3 text-[10px] text-[var(--bp-danger)]">
            {labels.ui.contentArtError}
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-[var(--bp-muted)]">
            {labels.ui.contentArtEmpty}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-1 p-1 sm:grid-cols-4">
            {filtered.map((img) => {
              const selected = value === img.src;
              return (
                <li key={img.src}>
                  <button
                    type="button"
                    className={[
                      "flex w-full flex-col overflow-hidden border p-1 text-left",
                      selected
                        ? "border-[var(--bp-gold)] bg-[color-mix(in_oklab,var(--bp-gold)_16%,transparent)]"
                        : "border-[var(--bp-line)]",
                    ].join(" ")}
                    onClick={() => onChange(img.src)}
                    title={img.src}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt=""
                      className="mx-auto h-12 w-12 object-contain"
                    />
                    <span className="mt-1 truncate text-[9px] leading-tight">
                      {img.name}
                    </span>
                    <span className="truncate text-[8px] text-[var(--bp-muted)]">
                      {img.folder}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
