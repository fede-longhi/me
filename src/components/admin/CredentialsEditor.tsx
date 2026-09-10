"use client";

import { useState } from "react";
import {
  AdminHeader,
  Field,
  LocaleTabs,
  inputClass,
  textareaClass,
  useCatalogEditor,
} from "@/components/admin/form";
import { newItemId } from "@/lib/catalog/normalize";
import { moveItem, patchBoth, patchLocale } from "@/lib/catalog/patch";
import type { LocalizedData } from "@/lib/types";

export function CredentialsEditor({ initial }: { initial: LocalizedData }) {
  const editor = useCatalogEditor(initial);
  const [locale, setLocale] = useState<"en" | "es">("es");
  const data = editor.catalog[locale];

  return (
    <div>
      <AdminHeader
        title="Credenciales"
        lead="Certificaciones, educación e idiomas."
        onSave={editor.save}
        pending={editor.pending}
        message={editor.message}
        error={editor.error}
      />
      <div className="mb-8">
        <LocaleTabs locale={locale} onChange={setLocale} />
      </div>

      <section className="mb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Certificaciones
          </h2>
          <button
            type="button"
            className="cursor-pointer text-sm font-semibold text-blue hover:text-blue-deep"
            onClick={() => {
              const id = newItemId("cert");
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (item) => ({
                  ...item,
                  certifications: [
                    ...item.certifications,
                    { id, name: "", issuer: "" },
                  ],
                })),
              );
            }}
          >
            + Agregar
          </button>
        </div>
        {data.certifications.map((cert, index) => (
          <article key={cert.id} className="grid gap-4 border border-ink/20 bg-white/90 p-5 sm:grid-cols-2">
            <Field label="Nombre">
              <input
                className={inputClass}
                value={cert.name}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (item) => ({
                      ...item,
                      certifications: item.certifications.map((row) =>
                        row.id === cert.id
                          ? { ...row, name: event.target.value }
                          : row,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Emisor">
              <input
                className={inputClass}
                value={cert.issuer}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (item) => ({
                      ...item,
                      certifications: item.certifications.map((row) =>
                        row.id === cert.id
                          ? { ...row, issuer: event.target.value }
                          : row,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <div className="flex gap-2 text-xs sm:col-span-2">
              <button
                type="button"
                className="cursor-pointer text-ink-muted hover:text-ink"
                onClick={() =>
                  editor.setCatalog((catalog) =>
                    patchBoth(catalog, (item) => ({
                      ...item,
                      certifications: moveItem(item.certifications, index, -1),
                    })),
                  )
                }
              >
                Subir
              </button>
              <button
                type="button"
                className="cursor-pointer text-red-700"
                onClick={() =>
                  editor.setCatalog((catalog) =>
                    patchBoth(catalog, (item) => ({
                      ...item,
                      certifications: item.certifications.filter(
                        (row) => row.id !== cert.id,
                      ),
                    })),
                  )
                }
              >
                Quitar
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="mb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Educación
          </h2>
          <button
            type="button"
            className="cursor-pointer text-sm font-semibold text-blue hover:text-blue-deep"
            onClick={() => {
              const id = newItemId("edu");
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (item) => ({
                  ...item,
                  education: [
                    ...item.education,
                    { id, school: "", period: "", degree: "", note: "" },
                  ],
                })),
              );
            }}
          >
            + Agregar
          </button>
        </div>
        {data.education.map((edu) => (
          <article key={edu.id} className="space-y-4 border border-ink/20 bg-white/90 p-5">
            <Field label="Institución">
              <input
                className={inputClass}
                value={edu.school}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (item) => ({
                      ...item,
                      education: item.education.map((row) =>
                        row.id === edu.id
                          ? { ...row, school: event.target.value }
                          : row,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título">
                <input
                  className={inputClass}
                  value={edu.degree ?? ""}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (item) => ({
                        ...item,
                        education: item.education.map((row) =>
                          row.id === edu.id
                            ? { ...row, degree: event.target.value }
                            : row,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Período">
                <input
                  className={inputClass}
                  value={edu.period}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (item) => ({
                        ...item,
                        education: item.education.map((row) =>
                          row.id === edu.id
                            ? { ...row, period: event.target.value }
                            : row,
                        ),
                      })),
                    )
                  }
                />
              </Field>
            </div>
            <Field label="Nota">
              <textarea
                className={textareaClass}
                value={edu.note ?? ""}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (item) => ({
                      ...item,
                      education: item.education.map((row) =>
                        row.id === edu.id
                          ? { ...row, note: event.target.value }
                          : row,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <button
              type="button"
              className="cursor-pointer text-xs text-red-700"
              onClick={() =>
                editor.setCatalog((catalog) =>
                  patchBoth(catalog, (item) => ({
                    ...item,
                    education: item.education.filter((row) => row.id !== edu.id),
                  })),
                )
              }
            >
              Quitar
            </button>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Idiomas
          </h2>
          <button
            type="button"
            className="cursor-pointer text-sm font-semibold text-blue hover:text-blue-deep"
            onClick={() => {
              const id = newItemId("lang");
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (item) => ({
                  ...item,
                  languages: [...item.languages, { id, name: "", level: "" }],
                })),
              );
            }}
          >
            + Agregar
          </button>
        </div>
        {data.languages.map((lang) => (
          <article key={lang.id} className="grid gap-4 border border-ink/20 bg-white/90 p-5 sm:grid-cols-2">
            <Field label="Idioma">
              <input
                className={inputClass}
                value={lang.name}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (item) => ({
                      ...item,
                      languages: item.languages.map((row) =>
                        row.id === lang.id
                          ? { ...row, name: event.target.value }
                          : row,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Nivel">
              <input
                className={inputClass}
                value={lang.level}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (item) => ({
                      ...item,
                      languages: item.languages.map((row) =>
                        row.id === lang.id
                          ? { ...row, level: event.target.value }
                          : row,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <button
              type="button"
              className="cursor-pointer text-xs text-red-700 sm:col-span-2"
              onClick={() =>
                editor.setCatalog((catalog) =>
                  patchBoth(catalog, (item) => ({
                    ...item,
                    languages: item.languages.filter((row) => row.id !== lang.id),
                  })),
                )
              }
            >
              Quitar
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
