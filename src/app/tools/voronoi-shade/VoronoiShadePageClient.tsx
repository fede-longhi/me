"use client";

import dynamic from "next/dynamic";

const VoronoiShadeTool = dynamic(
  () =>
    import("@/components/tools/VoronoiShadeTool").then(
      (mod) => mod.VoronoiShadeTool,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl px-5 py-16 text-sm text-ink-muted sm:px-8">
        Loading Voronoi shade tool…
      </div>
    ),
  },
);

export default function VoronoiShadePageClient() {
  return <VoronoiShadeTool />;
}
