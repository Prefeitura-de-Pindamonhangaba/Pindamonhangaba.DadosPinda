import { requirePageAccess } from "@/modules/auth/controllers/access-controller";
import { hasPermission } from "@/modules/auth/permissions";
import { PanelShell } from "@/shared/components/panel-shell";
import { AccountView } from "@/modules/auth/views/account-view";
export default async function AccountPage() {
  const principal = await requirePageAccess();
  return (
    <PanelShell
      userName={principal.name}
      admin={hasPermission(principal.role, "users:manage")}
      canConsult={hasPermission(principal.role, "consultations:read")}
    >
      <AccountView />
    </PanelShell>
  );
}
