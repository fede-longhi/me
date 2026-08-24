import type { Metadata } from "next";
import { SiteProviders } from "@/components/SiteProviders";
import { OrgDataBridgeTool } from "@/components/tools/OrgDataBridgeTool";

export const metadata: Metadata = {
  title: "Org Data Bridge — Tools — Fede Longhi",
  description:
    "Connect two Salesforce orgs, run SOQL on the source, and export JSON or CSV. / Conectá dos orgs Salesforce, ejecutá SOQL y exportá JSON o CSV.",
};

export default function OrgDataBridgePage() {
  return (
    <SiteProviders>
      <OrgDataBridgeTool />
    </SiteProviders>
  );
}
