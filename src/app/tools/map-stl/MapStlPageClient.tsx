"use client";

import dynamic from "next/dynamic";
import { SiteProviders } from "@/components/SiteProviders";

const MapStlTool = dynamic(
  () =>
    import("@/components/tools/MapStlTool").then((mod) => mod.MapStlTool),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl px-5 py-16 text-sm text-ink-muted sm:px-8">
        Loading map tool…
      </div>
    ),
  },
);

export default function MapStlPageClient() {
  return (
    <SiteProviders>
      <MapStlTool />
    </SiteProviders>
  );
}
