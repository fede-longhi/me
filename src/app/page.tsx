import { SiteChrome } from "@/components/SiteChrome";
import { SiteShell } from "@/components/SiteShell";

export default async function Home() {
  return (
    <SiteChrome>
      <SiteShell />
    </SiteChrome>
  );
}
