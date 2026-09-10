import { getSiteCatalog } from "@/lib/catalog";
import { HomeEditor } from "@/components/admin/HomeEditor";

export default async function AdminHomeContentPage() {
  const catalog = await getSiteCatalog();
  return <HomeEditor initial={catalog} />;
}
