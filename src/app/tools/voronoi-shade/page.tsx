import type { Metadata } from "next";
import VoronoiShadePageClient from "./VoronoiShadePageClient";

export const metadata: Metadata = {
  title: "Voronoi Shade — Tools — Fede Longhi",
  description:
    "Design a customizable Voronoi lampshade and export a 3D-printable STL. / Diseñá una pantalla Voronoi y exportá un STL imprimible.",
};

export default function VoronoiShadePage() {
  return <VoronoiShadePageClient />;
}
