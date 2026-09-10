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
import { patchBoth, patchLocale } from "@/lib/catalog/patch";
import type { LocalizedData } from "@/lib/types";

export function ContactEditor({ initial }: { initial: LocalizedData }) {
  const editor = useCatalogEditor(initial);
  const [locale, setLocale] = useState<"en" | "es">("es");
  const contact = editor.catalog[locale].contact;

  return (
    <div>
      <AdminHeader
        title="Contacto"
        lead="Nota, email, ubicación y links del footer."
        onSave={editor.save}
        pending={editor.pending}
        message={editor.message}
        error={editor.error}
      />
      <div className="mb-6">
        <LocaleTabs locale={locale} onChange={setLocale} />
      </div>
      <div className="space-y-4">
        <Field label="Nota">
          <textarea
            className={textareaClass}
            value={contact.note}
            onChange={(event) =>
              editor.setCatalog((catalog) =>
                patchLocale(catalog, locale, (data) => ({
                  ...data,
                  contact: { ...data.contact, note: event.target.value },
                })),
              )
            }
          />
        </Field>
        <Field label="Email (compartido)">
          <input
            className={inputClass}
            value={contact.email ?? ""}
            onChange={(event) =>
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (data) => ({
                  ...data,
                  contact: {
                    ...data.contact,
                    email: event.target.value || null,
                  },
                })),
              )
            }
          />
        </Field>
        <Field label="Ubicación">
          <input
            className={inputClass}
            value={contact.location ?? ""}
            onChange={(event) =>
              editor.setCatalog((catalog) =>
                patchLocale(catalog, locale, (data) => ({
                  ...data,
                  contact: {
                    ...data.contact,
                    location: event.target.value || null,
                  },
                })),
              )
            }
          />
        </Field>
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Links
          </h2>
          <button
            type="button"
            className="cursor-pointer text-sm font-semibold text-blue hover:text-blue-deep"
            onClick={() => {
              const id = newItemId("link");
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (data) => ({
                  ...data,
                  contact: {
                    ...data.contact,
                    links: [
                      ...data.contact.links,
                      { id, label: "", href: "" },
                    ],
                  },
                })),
              );
            }}
          >
            + Agregar link
          </button>
        </div>
        {contact.links.map((link) => (
          <article
            key={link.id ?? link.href}
            className="grid gap-4 border border-ink/20 bg-white/90 p-5 sm:grid-cols-2"
          >
            <Field label="Label">
              <input
                className={inputClass}
                value={link.label}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      contact: {
                        ...data.contact,
                        links: data.contact.links.map((row) =>
                          row.id === link.id
                            ? { ...row, label: event.target.value }
                            : row,
                        ),
                      },
                    })),
                  )
                }
              />
            </Field>
            <Field label="Href (compartido)">
              <input
                className={inputClass}
                value={link.href}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchBoth(catalog, (data) => ({
                      ...data,
                      contact: {
                        ...data.contact,
                        links: data.contact.links.map((row) =>
                          row.id === link.id
                            ? { ...row, href: event.target.value }
                            : row,
                        ),
                      },
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
                  patchBoth(catalog, (data) => ({
                    ...data,
                    contact: {
                      ...data.contact,
                      links: data.contact.links.filter((row) => row.id !== link.id),
                    },
                  })),
                )
              }
            >
              Quitar
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
