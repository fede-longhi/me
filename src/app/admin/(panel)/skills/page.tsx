import { getSiteCatalog } from "@/lib/catalog";
import { SkillsEditor } from "@/components/admin/SkillsEditor";

export default async function AdminSkillsPage() {
  const catalog = await getSiteCatalog();
  return <SkillsEditor initial={catalog} />;
}
