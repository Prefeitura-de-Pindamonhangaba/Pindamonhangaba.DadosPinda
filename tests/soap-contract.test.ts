import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { createClientAsync } from "soap";
import { join } from "node:path";
import { SoapInfoconvAdapter } from "../src/modules/data-sources/infoconv/transports/soap/soap-adapter";

test("WSDL oficiais serializam os parâmetros do legado e leem respostas SOAP locais", async () => {
  for (const kind of ["cpf", "cnpj"] as const) {
    const operation =
      kind === "cpf" ? "ConsultarCPFPDEC8789" : "ConsultarCNPJPDEC8789";
    const profile =
      kind === "cpf" ? "PessoaPerfilDEC8789" : "CNPJPerfilDEC8789";
    const document = kind === "cpf" ? "11144477735" : "04252011000110";
    const wsdlPath = join(import.meta.dir, "fixtures", `infoconv-${kind}.wsdl`);
    const wsdl = await Bun.file(wsdlPath).text();
    const namespace = wsdl.match(/targetNamespace="([^"]+)"/)![1];
    let requestBody = "";
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      requestBody = Buffer.concat(chunks).toString("utf8");
      response.setHeader("Content-Type", "text/xml;charset=utf-8");
      response.end(
        `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operation}Response xmlns="${namespace}"><${operation}Result><${profile}><${kind.toUpperCase()}>${document}</${kind.toUpperCase()}><${kind === "cpf" ? "Nome" : "NomeEmpresarial"}>CADASTRO FICTÍCIO</${kind === "cpf" ? "Nome" : "NomeEmpresarial"}></${profile}></${operation}Result></${operation}Response></soap:Body></soap:Envelope>`,
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Servidor local indisponível.");
      const client = await createClientAsync(wsdlPath, {
        endpoint: `http://127.0.0.1:${address.port}`,
        forceUseSchemaXmlns: true,
      });
      const method: unknown = client[`${operation}Async`];
      if (typeof method !== "function")
        throw new Error("Método ausente no WSDL.");
      const adapter = new SoapInfoconvAdapter({
        async request() {
          const output: unknown = await method.call(
            client,
            kind === "cpf"
              ? { ListaDeCPF: document, CPFUsuario: "11144477735" }
              : { CNPJ: document, CPFUsuario: "11144477735" },
          );
          if (!Array.isArray(output)) throw new Error("Resposta inválida.");
          return output[0];
        },
      });
      const result = await adapter.consult(kind, document);
      expect(result.data[kind.toUpperCase()]).toBe(document);
      expect(requestBody).toContain(operation);
      expect(requestBody).toContain("CPFUsuario");
      expect(requestBody).toContain(kind === "cpf" ? "ListaDeCPF" : "CNPJ");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});
