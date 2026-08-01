import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { ImageGridTool } from "@/components/tools/ImageGridTool";

export const metadata: Metadata = {
  title: "Image Grid — Tools — Fede Longhi",
  description:
    "Generate a fine grid overlay and a thick blank grid from an uploaded image. / Generá una grilla fina sobre una imagen y una grilla gruesa en blanco.",
};

export default function ImageGridPage() {
  return (
    <SiteProviders>
      <ImageGridTool />
    </SiteProviders>
  );
}
