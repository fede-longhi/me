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
import { patchBoth, patchLocale } from "@/lib/catalog/patch";
import type { LocalizedData } from "@/lib/types";

export function HomeEditor({ initial }: { initial: LocalizedData }) {
  const editor = useCatalogEditor(initial);
  const [locale, setLocale] = useState<"en" | "es">("es");
  const home = editor.catalog[locale].home;

  return (
    <div>
      <AdminHeader
        title="Home"
        lead="Headline, tagline y CTAs del hero. El copy se edita por idioma; el CV es compartido."
        onSave={editor.save}
        pending={editor.pending}
        message={editor.message}
        error={editor.error}
      />
      <div className="mb-6">
        <LocaleTabs locale={locale} onChange={setLocale} />
      </div>
      <div className="space-y-4">
        <Field label="Nombre">
          <input
            className={inputClass}
            value={home.name}
            onChange={(event) =>
              editor.setCatalog((catalog) =>
                patchLocale(catalog, locale, (data) => ({
                  ...data,
                  home: { ...data.home, name: event.target.value },
                })),
              )
            }
          />
        </Field>
        <Field label="Headline">
          <input
            className={inputClass}
            value={home.headline}
            onChange={(event) =>
              editor.setCatalog((catalog) =>
                patchLocale(catalog, locale, (data) => ({
                  ...data,
                  home: { ...data.home, headline: event.target.value },
                })),
              )
            }
          />
        </Field>
        <Field label="Tagline">
          <textarea
            className={textareaClass}
            value={home.tagline}
            onChange={(event) =>
              editor.setCatalog((catalog) =>
                patchLocale(catalog, locale, (data) => ({
                  ...data,
                  home: { ...data.home, tagline: event.target.value },
                })),
              )
            }
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CTA primario — texto">
            <input
              className={inputClass}
              value={home.ctaPrimary.label}
              onChange={(event) =>
                editor.setCatalog((catalog) =>
                  patchLocale(catalog, locale, (data) => ({
                    ...data,
                    home: {
                      ...data.home,
                      ctaPrimary: {
                        ...data.home.ctaPrimary,
                        label: event.target.value,
                      },
                    },
                  })),
                )
              }
            />
          </Field>
          <Field label="CTA primario — href">
            <input
              className={inputClass}
              value={home.ctaPrimary.href}
              onChange={(event) =>
                editor.setCatalog((catalog) =>
                  patchBoth(catalog, (data) => ({
                    ...data,
                    home: {
                      ...data.home,
                      ctaPrimary: {
                        ...data.home.ctaPrimary,
                        href: event.target.value,
                      },
                    },
                  })),
                )
              }
            />
          </Field>
          <Field label="CTA secundario — texto">
            <input
              className={inputClass}
              value={home.ctaSecondary.label}
              onChange={(event) =>
                editor.setCatalog((catalog) =>
                  patchLocale(catalog, locale, (data) => ({
                    ...data,
                    home: {
                      ...data.home,
                      ctaSecondary: {
                        ...data.home.ctaSecondary,
                        label: event.target.value,
                      },
                    },
                  })),
                )
              }
            />
          </Field>
          <Field label="CTA secundario — href">
            <input
              className={inputClass}
              value={home.ctaSecondary.href}
              onChange={(event) =>
                editor.setCatalog((catalog) =>
                  patchBoth(catalog, (data) => ({
                    ...data,
                    home: {
                      ...data.home,
                      ctaSecondary: {
                        ...data.home.ctaSecondary,
                        href: event.target.value,
                      },
                    },
                  })),
                )
              }
            />
          </Field>
        </div>
        <Field label="CV (href compartido)">
          <input
            className={inputClass}
            value={home.cvHref}
            onChange={(event) =>
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (data) => ({
                  ...data,
                  home: { ...data.home, cvHref: event.target.value },
                })),
              )
            }
          />
        </Field>
      </div>
    </div>
  );
}
