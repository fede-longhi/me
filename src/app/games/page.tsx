import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { GamesPageShell } from "@/components/GamesPageShell";
import { getSiteCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Games — Fede Longhi",
  description:
    "Playable experiments and games by Fede Longhi. / Experimentos jugables y juegos de Fede Longhi.",
};

export default async function GamesPage() {
  const catalog = await getSiteCatalog();
  if (!catalog.en.flags.games) {
    notFound();
  }

  return (
    <SiteChrome>
      <GamesPageShell />
    </SiteChrome>
  );
}
