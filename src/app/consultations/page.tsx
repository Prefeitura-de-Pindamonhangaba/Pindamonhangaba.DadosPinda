import { requirePageAccess } from "@/modules/auth/controllers/access-controller";
import { hasPermission, type Permission } from "@/modules/auth/permissions";
import { PanelShell } from "@/shared/components/panel-shell";
import { ConsultationView } from "@/modules/consultations/views/consultation-view";

export default async function ConsultationsPage() {
  const principal = await requirePageAccess("consultations:read");
  const permissions = (
    [
      "consultations:cpf",
      "consultations:cnpj",
      "consultations:batch",
      "consultations:export",
      "consultations:refresh",
    ] satisfies Permission[]
  ).filter((permission) => hasPermission(principal.role, permission));
  return (
    <PanelShell
      userName={principal.name}
      admin={hasPermission(principal.role, "users:manage")}
    >
      <ConsultationView permissions={permissions} />
    </PanelShell>
  );
}
