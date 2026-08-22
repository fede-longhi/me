import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { FarmearAuraGame } from "@/components/games/FarmearAuraGame";

export const metadata: Metadata = {
  title: "Farmear Aura — Games — Fede Longhi",
  description:
    "Aura farming battle. Hit gestures on the beat, don't spam, watch six seven show up. / Batalla de farmear aura. Gestos a ritmo, sin spam, con six seven.",
};

export default function FarmearAuraPage() {
  return (
    <SiteProviders>
      <FarmearAuraGame />
    </SiteProviders>
  );
}
