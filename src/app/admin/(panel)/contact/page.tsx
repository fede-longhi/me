import { getSiteCatalog } from "@/lib/catalog";
import { ContactEditor } from "@/components/admin/ContactEditor";

export default async function AdminContactPage() {
  const catalog = await getSiteCatalog();
  return <ContactEditor initial={catalog} />;
}
