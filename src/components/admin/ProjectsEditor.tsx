"use client";

import { useState } from "react";
import {
  AdminHeader,
  Field,
  LocaleTabs,
  Toggle,
  inputClass,
  textareaClass,
  useCatalogEditor,
} from "@/components/admin/form";
import { newItemId } from "@/lib/catalog/normalize";
import {
  joinLines,
  listLines,
  moveItem,
  patchBoth,
  patchLocale,
} from "@/lib/catalog/patch";
import type { LocalizedData, ProjectItem } from "@/lib/types";

function emptyProject(): ProjectItem {
  return {
    id: newItemId("project"),
    name: "",
    category: "",
    description: "",
    featured: false,
    published: true,
    slug: "",
    status: "",
    details: "",
    highlights: [],
    tech_stack: [],
    link: "",
    link_label: "",
    preview_image: "",
    preview_alt: "",
  };
}

export function ProjectsEditor({ initial }: { initial: LocalizedData }) {
  const editor = useCatalogEditor(initial);
  const [locale, setLocale] = useState<"en" | "es">("es");
  const projects = editor.catalog[locale].projects;

  return (
    <div>
      <AdminHeader
        title="Proyectos"
        lead="Published los muestra en el sitio; featured los pone como cards grandes en home."
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
            const project = emptyProject();
            editor.setCatalog((catalog) =>
              patchBoth(catalog, (data) => ({
                ...data,
                projects: [...data.projects, { ...project }],
              })),
            );
          }}
        >
          + Agregar proyecto
        </button>
      </div>
      <div className="space-y-5">
        {projects.map((project, index) => (
          <article key={project.id} className="space-y-4 border border-ink/20 bg-white/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">
                {project.name || "Nuevo proyecto"}
              </p>
              <div className="flex flex-wrap gap-3">
                <Toggle
                  label="Published"
                  checked={project.published !== false}
                  onChange={(value) =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, published: value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
                <Toggle
                  label="Featured"
                  checked={project.featured === true}
                  onChange={(value) =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, featured: value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
                <button
                  type="button"
                  className="cursor-pointer text-xs text-ink-muted hover:text-ink"
                  onClick={() =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        projects: moveItem(data.projects, index, -1),
                      })),
                    )
                  }
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-xs text-red-700"
                  onClick={() =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        projects: data.projects.filter(
                          (item) => item.id !== project.id,
                        ),
                      })),
                    )
                  }
                >
                  Quitar
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <input
                  className={inputClass}
                  value={project.name}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Categoría">
                <input
                  className={inputClass}
                  value={project.category}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, category: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
            </div>
            <Field label="Descripción">
              <textarea
                className={textareaClass}
                value={project.description}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      projects: data.projects.map((item) =>
                        item.id === project.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Detalles">
              <textarea
                className={textareaClass}
                value={project.details ?? ""}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      projects: data.projects.map((item) =>
                        item.id === project.id
                          ? { ...item, details: event.target.value }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Highlights (uno por línea)">
              <textarea
                className={textareaClass}
                value={joinLines(project.highlights)}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      projects: data.projects.map((item) =>
                        item.id === project.id
                          ? { ...item, highlights: listLines(event.target.value) }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Tech stack (uno por línea)">
              <textarea
                className={textareaClass}
                value={joinLines(project.tech_stack)}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      projects: data.projects.map((item) =>
                        item.id === project.id
                          ? { ...item, tech_stack: listLines(event.target.value) }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <input
                  className={inputClass}
                  value={project.status ?? ""}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, status: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Slug (compartido)">
                <input
                  className={inputClass}
                  value={project.slug ?? ""}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, slug: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Link (compartido)">
                <input
                  className={inputClass}
                  value={project.link ?? ""}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, link: event.target.value || null }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Label del link">
                <input
                  className={inputClass}
                  value={project.link_label ?? ""}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, link_label: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Preview image (compartido)">
                <input
                  className={inputClass}
                  value={project.preview_image ?? ""}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? {
                                ...item,
                                preview_image: event.target.value || null,
                              }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
              <Field label="Preview alt">
                <input
                  className={inputClass}
                  value={project.preview_alt ?? ""}
                  onChange={(event) =>
                    editor.setCatalog((catalog) =>
                      patchLocale(catalog, locale, (data) => ({
                        ...data,
                        projects: data.projects.map((item) =>
                          item.id === project.id
                            ? { ...item, preview_alt: event.target.value }
                            : item,
                        ),
                      })),
                    )
                  }
                />
              </Field>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
