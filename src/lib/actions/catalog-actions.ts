"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { saveSiteCatalog } from "@/lib/catalog";
import { normalizeCatalog } from "@/lib/catalog/normalize";
import { localizedDataSchema } from "@/lib/catalog/schema";
import type { LocalizedData } from "@/lib/types";

export type CatalogActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
}

export async function saveCatalogAction(
  catalog: LocalizedData,
): Promise<CatalogActionResult> {
  await requireAdmin();

  const parsed = localizedDataSchema.safeParse(normalizeCatalog(catalog));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "catálogo";
    return {
      ok: false,
      error: first ? `${path}: ${first.message}` : "Datos inválidos",
    };
  }

  try {
    await saveSiteCatalog(parsed.data as LocalizedData);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el catálogo",
    };
  }

  revalidateTag("site-catalog", "max");
  revalidatePath("/", "layout");
  revalidatePath("/tools");
  revalidatePath("/games");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
