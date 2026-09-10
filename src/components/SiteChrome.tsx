import { getPublicCatalog } from "@/lib/catalog";
import { SiteProviders } from "@/components/SiteProviders";

export async function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const catalog = await getPublicCatalog();
  return <SiteProviders catalog={catalog}>{children}</SiteProviders>;
}
