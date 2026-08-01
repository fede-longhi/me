"use client";

import { LanguageProvider } from "@/components/LanguageProvider";
import { siteCatalog } from "@/lib/catalog";

export function SiteProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider catalog={siteCatalog}>{children}</LanguageProvider>
  );
}
