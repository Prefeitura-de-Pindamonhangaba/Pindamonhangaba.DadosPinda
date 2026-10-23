import { readFile } from "node:fs/promises";
import { Agent } from "node:https";
import { X509Certificate } from "node:crypto";
import { createClientAsync, HttpClient } from "soap";
import type { InfoconvEnvironment } from "./env";
import { parseInfoconvResponse } from "./response-schema";
import {
  ConsultationError,
  type DataSourceAdapter,
  type DocumentKind,
} from "@/modules/consultations/models/consultation-types";

export function assertOfficialInfoconvUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "acesso.infoconv.receita.fazenda.gov.br" ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/ws\/(cpf\/consultarcpf|cnpj\/consultarcnpj)\.asmx$/i.test(url.pathname)
  )
    throw new ConsultationError("unavailable");
}

class RestrictedHttpClient extends HttpClient {
  constructor(
    private readonly agent: Agent,
    private readonly timeout: number,
  ) {
    super();
  }
  override buildRequest(
    url: string,
    data: unknown,
    headers?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) {
    assertOfficialInfoconvUrl(url);
    return super.buildRequest(url, data, headers, {
      ...options,
      httpsAgent: this.agent,
      timeout: this.timeout,
      maxRedirects: 0,
      maxContentLength: 2_000_000,
      maxBodyLength: 100_000,
      proxy: false,
    });
  }
}

export class InfoconvAdapter implements DataSourceAdapter {
  constructor(private readonly env: InfoconvEnvironment) {}
  async consult(kind: DocumentKind, document: string) {
    if (this.env.INFOCONV_ENABLED !== "true")
      throw new ConsultationError("unavailable");
    let agent: Agent | undefined;
    try {
      const pem = await readFile(this.env.INFOCONV_CERTIFICATE_PATH);
      const certificate = new X509Certificate(pem);
      if (
        Date.parse(certificate.validTo) <= Date.now() ||
        Date.parse(certificate.validFrom) > Date.now()
      )
        throw new ConsultationError("unavailable");
      const ca = this.env.INFOCONV_CA_PATH
        ? await readFile(this.env.INFOCONV_CA_PATH)
        : undefined;
      agent = new Agent({
        cert: pem,
        key: pem,
        ca,
        passphrase: this.env.INFOCONV_CERTIFICATE_PASSPHRASE,
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      });
      const wsdl =
        kind === "cpf"
          ? this.env.INFOCONV_CPF_WSDL
          : this.env.INFOCONV_CNPJ_WSDL;
      assertOfficialInfoconvUrl(wsdl);
      const client = await createClientAsync(wsdl, {
        httpClient: new RestrictedHttpClient(
          agent,
          this.env.INFOCONV_TIMEOUT_MS,
        ),
        forceUseSchemaXmlns: true,
      });
      const operation =
        kind === "cpf"
          ? "ConsultarCPFPDEC8789Async"
          : "ConsultarCNPJPDEC8789Async";
      const method: unknown = client[operation];
      if (typeof method !== "function")
        throw new ConsultationError("invalid_response");
      const parameters =
        kind === "cpf"
          ? {
              ListaDeCPF: document,
              CPFUsuario: this.env.INFOCONV_REQUESTER_CPF,
            }
          : { CNPJ: document, CPFUsuario: this.env.INFOCONV_REQUESTER_CPF };
      const output: unknown = await method.call(client, parameters);
      if (!Array.isArray(output))
        throw new ConsultationError("invalid_response");
      return { data: parseInfoconvResponse(kind, document, output[0]) };
    } catch (error) {
      // Nunca propagar SoapFault, XML, certificados ou configuração de transporte.
      if (error instanceof ConsultationError) throw error;
      throw new ConsultationError("unavailable");
    } finally {
      agent?.destroy();
    }
  }
}
