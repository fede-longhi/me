import { getSiteCatalog } from "@/lib/catalog";
import { CredentialsEditor } from "@/components/admin/CredentialsEditor";

export default async function AdminCredentialsPage() {
  const catalog = await getSiteCatalog();
  return <CredentialsEditor initial={catalog} />;
}
