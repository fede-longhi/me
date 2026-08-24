"use client";

import dynamic from "next/dynamic";
import { SiteProviders } from "@/components/SiteProviders";

const LithophaneTool = dynamic(
  () =>
    import("@/components/tools/LithophaneTool").then((mod) => mod.LithophaneTool),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl px-5 py-16 text-sm text-ink-muted sm:px-8">
        Loading lithophane tool…
      </div>
    ),
  },
);

export default function LithophanePageClient() {
  return (
    <SiteProviders>
      <LithophaneTool />
    </SiteProviders>
  );
}
