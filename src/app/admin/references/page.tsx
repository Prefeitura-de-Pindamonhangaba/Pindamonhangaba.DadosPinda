import { loadReferencesPage } from "@/modules/reference-data/controllers/reference-controller";
import { PanelShell } from "@/shared/components/panel-shell";
import { ReferencesView } from "@/modules/reference-data/views/references-view";
export default async function ReferencesPage() {
  const { principal, data } = await loadReferencesPage();
  return (
    <PanelShell userName={principal.name} admin>
      <ReferencesView initialData={data} />
    </PanelShell>
  );
}
