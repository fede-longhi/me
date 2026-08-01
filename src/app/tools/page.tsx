import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { ToolsPageShell } from "@/components/ToolsPageShell";

export const metadata: Metadata = {
  title: "Tools — Fede Longhi",
  description:
    "Utilities and helper tools by Fede Longhi. / Herramientas y utilidades de Fede Longhi.",
};

export default function ToolsPage() {
  return (
    <SiteProviders>
      <ToolsPageShell />
    </SiteProviders>
  );
}
