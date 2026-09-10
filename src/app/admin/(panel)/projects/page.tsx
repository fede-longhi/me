import { getSiteCatalog } from "@/lib/catalog";
import { ProjectsEditor } from "@/components/admin/ProjectsEditor";

export default async function AdminProjectsPage() {
  const catalog = await getSiteCatalog();
  return <ProjectsEditor initial={catalog} />;
}
