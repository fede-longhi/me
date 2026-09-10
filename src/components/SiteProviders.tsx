"use client";

import { LanguageProvider } from "@/components/LanguageProvider";
import type { LocalizedData } from "@/lib/types";

export function SiteProviders({
  catalog,
  children,
}: {
  catalog: LocalizedData;
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider catalog={catalog}>{children}</LanguageProvider>
  );
}
