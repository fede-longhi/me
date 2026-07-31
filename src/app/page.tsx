import rawData from "../../data.json";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SiteShell } from "@/components/SiteShell";
import type { LocalizedData } from "@/lib/types";

const catalog = rawData as LocalizedData;

export default function Home() {
  return (
    <LanguageProvider catalog={catalog}>
      <SiteShell />
    </LanguageProvider>
  );
}
