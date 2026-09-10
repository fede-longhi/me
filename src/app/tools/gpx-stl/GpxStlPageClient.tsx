"use client";

import dynamic from "next/dynamic";

const GpxTerrainTool = dynamic(
  () =>
    import("@/components/tools/GpxTerrainTool").then((mod) => mod.GpxTerrainTool),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl px-5 py-16 text-sm text-ink-muted sm:px-8">
        Loading GPX tool…
      </div>
    ),
  },
);

export default function GpxStlPageClient() {
  return <GpxTerrainTool />;
}
