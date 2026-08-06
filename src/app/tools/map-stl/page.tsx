import type { Metadata } from "next";
import MapStlPageClient from "./MapStlPageClient";

export const metadata: Metadata = {
  title: "Map to STL — Tools — Fede Longhi",
  description:
    "Select a map area and export a 3D printable terrain STL. / Seleccioná un área del mapa y exportá un STL del terreno.",
};

export default function MapStlPage() {
  return <MapStlPageClient />;
}
