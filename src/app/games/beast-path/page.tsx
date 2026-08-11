import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { BeastPathGame } from "@/components/games/BeastPathGame";

export const metadata: Metadata = {
  title: "Beast Path — Games — Fede Longhi",
  description:
    "Roguelike path with monster pets, battles, shops and events. / Roguelike con monstruos mascota, peleas, tiendas y eventos.",
};

export default function BeastPathPage() {
  return (
    <SiteProviders>
      <BeastPathGame />
    </SiteProviders>
  );
}
