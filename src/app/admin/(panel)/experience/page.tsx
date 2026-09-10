import { getSiteCatalog } from "@/lib/catalog";
import { ExperienceEditor } from "@/components/admin/ExperienceEditor";

export default async function AdminExperiencePage() {
  const catalog = await getSiteCatalog();
  return <ExperienceEditor initial={catalog} />;
}
