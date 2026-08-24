import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { FarmearAuraGame } from "@/components/games/FarmearAuraGame";

export const metadata: Metadata = {
  title: "Farmear Aura — Games — Fede Longhi",
  description:
    "Aura farming battle. Pick up to six body and face gestures, hit the beat, don't spam. / Batalla de farmear aura. Elegí hasta seis gestos de cuerpo y cara, a ritmo, sin spam.",
};

export default function FarmearAuraPage() {
  return (
    <SiteProviders>
      <FarmearAuraGame />
    </SiteProviders>
  );
}
