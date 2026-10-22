import { FoundationView } from "@/modules/foundation/views/foundation-view";
import { requirePageAccess } from "@/modules/auth/controllers/access-controller";

export default async function HomePage() {
  const principal = await requirePageAccess();
  return <FoundationView userName={principal.name} />;
}
