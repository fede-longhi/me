import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { ImageGridTool } from "@/components/tools/ImageGridTool";

export const metadata: Metadata = {
  title: "Image Grid — Tools — Fede Longhi",
  description:
    "Generate a grid overlay and a blank grid from an uploaded image, with adjustable line thickness. / Generá una grilla sobre una imagen y una en blanco, con grosor de línea ajustable.",
};

export default function ImageGridPage() {
  return (
    <SiteProviders>
      <ImageGridTool />
    </SiteProviders>
  );
}
