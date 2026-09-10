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
import { joinLines, listLines, moveItem, patchBoth, patchLocale } from "@/lib/catalog/patch";
import type { ExperienceItem, LocalizedData } from "@/lib/types";

function emptyJob(): ExperienceItem {
  return {
    id: newItemId("job"),
    role: "",
    company: "",
    period: "",
    description: "",
    bullets: [],
  };
}

export function ExperienceEditor({ initial }: { initial: LocalizedData }) {
  const editor = useCatalogEditor(initial);
  const [locale, setLocale] = useState<"en" | "es">("es");
  const jobs = editor.catalog[locale].experience;

  return (
    <div>
      <AdminHeader
        title="Experiencia"
        lead="Puestos de trabajo. El orden es compartido entre idiomas."
        onSave={editor.save}
        pending={editor.pending}
        message={editor.message}
        error={editor.error}
      />
      <div className="mb-6 flex items-center justify-between gap-4">
        <LocaleTabs locale={locale} onChange={setLocale} />
        <button
          type="button"
          className="cursor-pointer text-sm font-semibold text-blue hover:text-blue-deep"
          onClick={() => {
            const job = emptyJob();
            editor.setCatalog((catalog) =>
              patchBoth(catalog, (data) => ({
                ...data,
                experience: [...data.experience, { ...job }],
              })),
            );
          }}
        >
          + Agregar puesto
        </button>
      </div>
      <div className="space-y-5">
        {jobs.map((job, index) => (
          <article key={job.id} className="space-y-4 border border-ink/20 bg-white/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {job.company || "Nuevo puesto"}
              </p>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="cursor-pointer text-ink-muted hover:text-ink"
                  onClick={() =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        experience: moveItem(data.experience, index, -1),
                      })),
                    )
                  }
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-ink-muted hover:text-ink"
                  onClick={() =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        experience: moveItem(data.experience, index, 1),
                      })),
                    )
                  }
                >
                  Bajar
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-red-700 hover:underline"
                  onClick={() =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        experience: data.experience.filter((item) => item.id !== job.id),
                      })),
                    )
                  }
                >
                  Quitar
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rol">
                <input
                  className={inputClass}
                  value={job.role}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (data) => ({
                        ...data,
                        experience: data.experience.map((item) =>
                          item.id === job.id
                            ? { ...item, role: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Compañía">
                <input
                  className={inputClass}
                  value={job.company}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (data) => ({
                        ...data,
                        experience: data.experience.map((item) =>
                          item.id === job.id
                            ? { ...item, company: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
            </div>
            <Field label="Período">
              <input
                className={inputClass}
                value={job.period}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      experience: data.experience.map((item) =>
                        item.id === job.id
                          ? { ...item, period: event.target.value }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Descripción">
              <textarea
                className={textareaClass}
                value={job.description ?? ""}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      experience: data.experience.map((item) =>
                        item.id === job.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Bullets (uno por línea)">
              <textarea
                className={textareaClass}
                value={joinLines(job.bullets)}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      experience: data.experience.map((item) =>
                        item.id === job.id
                          ? { ...item, bullets: listLines(event.target.value) }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
          </article>
        ))}
      </div>
    </div>
  );
}
