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
import type { LocalizedData } from "@/lib/types";

export function SkillsEditor({ initial }: { initial: LocalizedData }) {
  const editor = useCatalogEditor(initial);
  const [locale, setLocale] = useState<"en" | "es">("es");
  const groups = editor.catalog[locale].skills;

  return (
    <div>
      <AdminHeader
        title="Skills"
        lead="Grupos de skills. El orden es compartido; los nombres de grupo se traducen."
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
            const id = newItemId("skill");
            editor.setCatalog((catalog) =>
              patchBoth(catalog, (data) => ({
                ...data,
                skills: [...data.skills, { id, group: "", items: [] }],
              })),
            );
          }}
        >
          + Agregar grupo
        </button>
      </div>
      <div className="space-y-5">
        {groups.map((group, index) => (
          <article key={group.id} className="space-y-4 border border-ink/20 bg-white/90 p-5">
            <div className="flex justify-between gap-2 text-xs">
              <button
                type="button"
                className="cursor-pointer text-ink-muted hover:text-ink"
                onClick={() =>
                  editor.setCatalog((catalog) =>
                    patchBoth(catalog, (data) => ({
                      ...data,
                      skills: moveItem(data.skills, index, -1),
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
                    patchBoth(catalog, (data) => ({
                      ...data,
                      skills: data.skills.filter((item) => item.id !== group.id),
                    })),
                  )
                }
              >
                Quitar
              </button>
            </div>
            <Field label="Grupo">
              <input
                className={inputClass}
                value={group.group}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      skills: data.skills.map((item) =>
                        item.id === group.id
                          ? { ...item, group: event.target.value }
                          : item,
                      ),
                    })),
                  )
                }
              />
            </Field>
            <Field label="Items (uno por línea)">
              <textarea
                className={textareaClass}
                value={joinLines(group.items)}
                onChange={(event) =>
                  editor.setCatalog((catalog) =>
                    patchLocale(catalog, locale, (data) => ({
                      ...data,
                      skills: data.skills.map((item) =>
                        item.id === group.id
                          ? { ...item, items: listLines(event.target.value) }
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
