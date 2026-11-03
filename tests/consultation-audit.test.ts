import { expect, test } from "bun:test";
import { listConsultationAudit } from "../src/modules/consultations/services/audit-service";
import type { ConsultationRepository } from "../src/modules/consultations/models/consultation-repository";

test("operadores e visualizadores não alcançam o repositório de auditoria", async () => {
  const repository = new Proxy({} as ConsultationRepository, {
    get() {
      throw new Error("Acesso indevido ao repositório");
    },
  });
  for (const role of ["viewer", "operator"]) {
    await expect(
      listConsultationAudit(repository, {
        id: "test",
        name: "Servidor",
        role,
        enabled: true,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  }
});
