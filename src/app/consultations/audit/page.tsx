import { requirePageAccess } from "@/modules/auth/controllers/access-controller";
import { hasPermission } from "@/modules/auth/permissions";
import { PanelShell } from "@/shared/components/panel-shell";
import { AuditView } from "@/modules/consultations/views/audit-view";
export default async function AuditPage() {
  const principal = await requirePageAccess("consultations:read");
  return (
    <PanelShell
      userName={principal.name}
      admin={hasPermission(principal.role, "users:manage")}
    >
      <AuditView />
    </PanelShell>
  );
}
