import { FoundationView } from "@/modules/foundation/views/foundation-view";
import { requirePageAccess } from "@/modules/auth/controllers/access-controller";
import { hasPermission } from "@/modules/auth/permissions";

export default async function HomePage() {
  const principal = await requirePageAccess();
  return (
    <FoundationView
      userName={principal.name}
      admin={hasPermission(principal.role, "users:manage")}
      canConsult={hasPermission(principal.role, "consultations:read")}
    />
  );
}
