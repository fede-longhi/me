import { getSiteCatalog } from "@/lib/catalog";
import { CatalogFlagsEditor } from "@/components/admin/CatalogFlagsEditor";

export default async function AdminCatalogPage() {
  const catalog = await getSiteCatalog();
  return <CatalogFlagsEditor initial={catalog} />;
}
