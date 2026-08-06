import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { ImageGridTool } from "@/components/tools/ImageGridTool";

export const metadata: Metadata = {
  title: "Image Grid — Tools — Fede Longhi",
  description:
    "Generate a grid overlay and a blank grid from an uploaded image, with adjustable line thickness and color. / Generá una grilla sobre una imagen y una en blanco, con grosor y color de línea ajustables.",
};

export default function ImageGridPage() {
  return (
    <SiteProviders>
      <ImageGridTool />
    </SiteProviders>
  );
}
