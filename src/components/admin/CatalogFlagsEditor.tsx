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
import { joinLines, listLines, moveItem, patchBoth, patchLocale } from "@/lib/catalog/patch";
import type { GameItem, LocalizedData, ToolItem } from "@/lib/types";

export function CatalogFlagsEditor({ initial }: { initial: LocalizedData }) {
  const editor = useCatalogEditor(initial);
  const [locale, setLocale] = useState<"en" | "es">("es");
  const flags = editor.catalog.es.flags;
  const tools = editor.catalog[locale].tools;
  const games = editor.catalog[locale].games;

  function patchTool(id: string, patch: Partial<ToolItem>, both = false) {
    const apply = (items: ToolItem[]) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    editor.setCatalog((catalog) =>
      both
        ? patchBoth(catalog, (data) => ({ ...data, tools: apply(data.tools) }))
        : patchLocale(catalog, locale, (data) => ({
            ...data,
            tools: apply(data.tools),
          })),
    );
  }

  function patchGame(id: string, patch: Partial<GameItem>, both = false) {
    const apply = (items: GameItem[]) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    editor.setCatalog((catalog) =>
      both
        ? patchBoth(catalog, (data) => ({ ...data, games: apply(data.games) }))
        : patchLocale(catalog, locale, (data) => ({
            ...data,
            games: apply(data.games),
          })),
    );
  }

  return (
    <div>
      <AdminHeader
        title="Tools y games"
        lead="Los flags apagan la sección entera. Published oculta un item de los listados; featured lo muestra en la home. No crea páginas nuevas: el href tiene que existir en el código."
        onSave={editor.save}
        pending={editor.pending}
        message={editor.message}
        error={editor.error}
      />

      <section className="mb-10 space-y-5 border border-ink/20 bg-white/90 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Secciones
        </h2>
        <div className="flex flex-col gap-6">
          <Toggle
            label="Mostrar Tools (home, /tools y nav)"
            checked={flags.tools}
            onChange={(value) =>
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (data) => ({
                  ...data,
                  flags: { ...data.flags, tools: value },
                })),
              )
            }
          />
          <Toggle
            label="Mostrar Games (home, /games y nav)"
            checked={flags.games}
            onChange={(value) =>
              editor.setCatalog((catalog) =>
                patchBoth(catalog, (data) => ({
                  ...data,
                  flags: { ...data.flags, games: value },
                })),
              )
            }
          />
        </div>
      </section>

      <div className="mb-6">
        <LocaleTabs locale={locale} onChange={setLocale} />
      </div>

      <section className="mb-10 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Tools
        </h2>
        {tools.map((tool, index) => (
          <article key={tool.id} className="space-y-4 border border-ink/20 bg-white/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{tool.name}</p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <Toggle
                  label="Published"
                  checked={tool.published !== false}
                  onChange={(value) => patchTool(tool.id, { published: value }, true)}
                />
                <Toggle
                  label="Featured (home)"
                  checked={tool.featured === true}
                  onChange={(value) => patchTool(tool.id, { featured: value }, true)}
                />
                <button
                  type="button"
                  className="cursor-pointer text-xs text-ink-muted hover:text-ink"
                  onClick={() =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        tools: moveItem(data.tools, index, -1),
                      })),
                    )
                  }
                >
                  Subir
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <input
                  className={inputClass}
                  value={tool.name}
                  onChange={(event) =>
                    patchTool(tool.id, { name: event.target.value })
                  }
                />
              </Field>
              <Field label="Categoría">
                <input
                  className={inputClass}
                  value={tool.category}
                  onChange={(event) =>
                    patchTool(tool.id, { category: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Descripción">
              <textarea
                className={textareaClass}
                value={tool.description}
                onChange={(event) =>
                  patchTool(tool.id, { description: event.target.value })
                }
              />
            </Field>
            <Field label="Tags (uno por línea, compartidos)">
              <textarea
                className={textareaClass}
                value={joinLines(tool.tags)}
                onChange={(event) =>
                  patchTool(tool.id, { tags: listLines(event.target.value) }, true)
                }
              />
            </Field>
            <Field label="Href (ruta existente, compartido)">
              <input
                className={inputClass}
                value={tool.href}
                onChange={(event) =>
                  patchTool(tool.id, { href: event.target.value }, true)
                }
              />
            </Field>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Games
        </h2>
        {games.map((game, index) => (
          <article key={game.id} className="space-y-4 border border-ink/20 bg-white/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{game.name}</p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <Toggle
                  label="Published"
                  checked={game.published !== false}
                  onChange={(value) => patchGame(game.id, { published: value }, true)}
                />
                <Toggle
                  label="Featured (home)"
                  checked={game.featured === true}
                  onChange={(value) => patchGame(game.id, { featured: value }, true)}
                />
                <button
                  type="button"
                  className="cursor-pointer text-xs text-ink-muted hover:text-ink"
                  onClick={() =>
                    editor.setCatalog((catalog) =>
                      patchBoth(catalog, (data) => ({
                        ...data,
                        games: moveItem(data.games, index, -1),
                      })),
                    )
                  }
                >
                  Subir
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <input
                  className={inputClass}
                  value={game.name}
                  onChange={(event) =>
                    patchGame(game.id, { name: event.target.value })
                  }
                />
              </Field>
              <Field label="Categoría">
                <input
                  className={inputClass}
                  value={game.category}
                  onChange={(event) =>
                    patchGame(game.id, { category: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Descripción">
              <textarea
                className={textareaClass}
                value={game.description}
                onChange={(event) =>
                  patchGame(game.id, { description: event.target.value })
                }
              />
            </Field>
            <Field label="Href (ruta existente, compartido)">
              <input
                className={inputClass}
                value={game.href}
                onChange={(event) =>
                  patchGame(game.id, { href: event.target.value }, true)
                }
              />
            </Field>
          </article>
        ))}
      </section>
    </div>
  );
}
