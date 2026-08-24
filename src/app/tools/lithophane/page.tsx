import type { Metadata } from "next";
import LithophanePageClient from "./LithophanePageClient";

export const metadata: Metadata = {
  title: "Lithophane — Tools — Fede Longhi",
  description:
    "Turn a photo into a backlit 3D-printable lithophane STL. / Convertí una foto en un STL de litofanía para impresión 3D.",
};

export default function LithophanePage() {
  return <LithophanePageClient />;
}
