import { loadAdminUsersPage } from "@/modules/users/controllers/admin-user-controller";
import { PanelShell } from "@/shared/components/panel-shell";
import { AdminUsersView } from "@/modules/users/views/admin-users-view";
export default async function AdminUsersPage() {
  const { principal, users } = await loadAdminUsersPage();
  return (
    <PanelShell userName={principal.name} admin>
      <AdminUsersView initialUsers={users} />
    </PanelShell>
  );
}
