import { expect, test, mock } from "bun:test";
import {
  approveQuota,
  readQuota,
} from "../src/modules/consultations/services/quota-service";
import { currentQuotaMonth } from "../src/modules/consultations/services/quota-policy";
import { parseInfoconvEnvironment } from "../src/modules/data-sources/infoconv/env";
const admin = {
  id: crypto.randomUUID(),
  name: "Administrador fictício",
  role: "admin",
  enabled: true,
};
const repository = () => ({
  read: mock(async () => ({ additional: 0, history: [] })),
  approve: mock(async () => {}),
});
const input = () => ({
  month: currentQuotaMonth(),
  additional: 100,
  reason: "Autorização fictícia de despesas",
  acknowledgeAdditionalCharge: true,
});
test("franquia mensal padrão é 10.000 mesmo com configuração vazia", () => {
  const env = {
    INFOCONV_CERTIFICATE_PATH: "fake.pem",
    INFOCONV_REQUESTER_CPF: "11144477735",
    INFOCONV_CACHE_KEY: "ab".repeat(32),
    INFOCONV_AUDIT_KEY: "cd".repeat(32),
    INFOCONV_CPF_WSDL:
      "https://acesso.infoconv.receita.fazenda.gov.br/ws/cpf/consultarcpf.asmx?wsdl",
    INFOCONV_CNPJ_WSDL:
      "https://acesso.infoconv.receita.fazenda.gov.br/ws/cnpj/consultarcnpj.asmx?wsdl",
  };
  expect(parseInfoconvEnvironment(env).INFOCONV_MONTHLY_LIMIT).toBe(10000);
  expect(
    parseInfoconvEnvironment({ ...env, INFOCONV_MONTHLY_LIMIT: "" })
      .INFOCONV_MONTHLY_LIMIT,
  ).toBe(10000);
});
test("somente administrador libera excedente com ciência da cobrança e justificativa", async () => {
  const repo = repository();
  await expect(
    approveQuota(repo, { ...admin, role: "operator" }, input()),
  ).rejects.toThrow("forbidden");
  for (const invalid of [
    { acknowledgeAdditionalCharge: false },
    { additional: -1 },
    { additional: 0.5 },
    { reason: "curta" },
    { month: "2000-01" },
  ])
    await expect(
      approveQuota(repo, admin, { ...input(), ...invalid }),
    ).rejects.toThrow();
  expect(repo.approve).not.toHaveBeenCalled();
  await approveQuota(repo, admin, input());
  expect(repo.approve).toHaveBeenCalledWith({
    month: currentQuotaMonth(),
    additional: 100,
    reason: input().reason,
    actorId: admin.id,
  });
  await approveQuota(repo, admin, { ...input(), additional: 0 });
  expect(repo.approve).toHaveBeenCalledTimes(2);
});
test("liberação expira na virada do mês e a leitura consulta apenas o mês atual", async () => {
  expect(currentQuotaMonth(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
  expect(currentQuotaMonth(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
  const repo = repository();
  expect(await readQuota(repo, admin, 10000)).toMatchObject({
    included: 10000,
    additional: 0,
    month: currentQuotaMonth(),
  });
  expect(repo.read).toHaveBeenCalledWith(currentQuotaMonth());
});
