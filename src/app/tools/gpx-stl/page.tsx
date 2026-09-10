import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";
import GpxStlPageClient from "./GpxStlPageClient";

export const metadata: Metadata = {
  title: "GPX to STL — Tools — Fede Longhi",
  description:
    "Upload a GPS track, buffer a corridor, and export a 3D-printable terrain STL. / Subí un track GPS, definí un corredor y exportá un STL del terreno.",
};

export default function GpxStlPage() {
  return (
    <SiteChrome>
      <GpxStlPageClient />
    </SiteChrome>
  );
}
