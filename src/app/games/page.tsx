import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { GamesPageShell } from "@/components/GamesPageShell";

export const metadata: Metadata = {
  title: "Games — Fede Longhi",
  description:
    "Playable experiments and games by Fede Longhi. / Experimentos jugables y juegos de Fede Longhi.",
};

export default function GamesPage() {
  return (
    <SiteProviders>
      <GamesPageShell />
    </SiteProviders>
  );
}
