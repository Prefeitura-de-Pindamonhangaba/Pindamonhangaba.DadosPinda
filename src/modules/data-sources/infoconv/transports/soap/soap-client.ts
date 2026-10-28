import { loadInfoconvTlsOptions } from "../../certificate";
import { Agent } from "node:https";
import { createClientAsync, HttpClient } from "soap";
import type { SoapEnvironment } from "./env";
import type { SoapTransport } from "./soap-transport";
import {
  ConsultationError,
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

export class InfoconvSoapClient implements SoapTransport {
  constructor(
    private readonly env: SoapEnvironment,
    private readonly options: { enabled: boolean; timeoutMs: number },
  ) {}
  async request(kind: DocumentKind, document: string): Promise<unknown> {
    if (!this.options.enabled) throw new ConsultationError("unavailable");
    let agent: Agent | undefined;
    try {
      agent = new Agent(
        await loadInfoconvTlsOptions({
          certificatePath: this.env.INFOCONV_CERTIFICATE_PATH,
          format: this.env.INFOCONV_CERTIFICATE_FORMAT,
          passphrase: this.env.INFOCONV_CERTIFICATE_PASSPHRASE,
          caPath: this.env.INFOCONV_CA_PATH,
        }),
      );
      const wsdl =
        kind === "cpf"
          ? this.env.INFOCONV_CPF_WSDL
          : this.env.INFOCONV_CNPJ_WSDL;
      assertOfficialInfoconvUrl(wsdl);
      const client = await createClientAsync(wsdl, {
        httpClient: new RestrictedHttpClient(agent, this.options.timeoutMs),
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
      return output[0];
    } catch (error) {
      // Nunca propagar SoapFault, XML, certificados ou configuração de transporte.
      if (error instanceof ConsultationError) throw error;
      throw new ConsultationError("unavailable");
    } finally {
      agent?.destroy();
    }
  }
}
