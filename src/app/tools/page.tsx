import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { ToolsPageShell } from "@/components/ToolsPageShell";
import { getSiteCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Tools — Fede Longhi",
  description:
    "Utilities and helper tools by Fede Longhi. / Herramientas y utilidades de Fede Longhi.",
};

export default async function ToolsPage() {
  const catalog = await getSiteCatalog();
  if (!catalog.en.flags.tools) {
    notFound();
  }

  return (
    <SiteChrome>
      <ToolsPageShell />
    </SiteChrome>
  );
}
