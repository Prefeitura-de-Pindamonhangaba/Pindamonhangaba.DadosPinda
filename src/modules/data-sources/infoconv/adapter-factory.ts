import type { DataSourceAdapter } from "@/modules/consultations/models/consultation-types";
import type { InfoconvEnvironment } from "./env";

// Ponto único de seleção do protocolo. Importações SOAP não chegam ao serviço.
export async function createInfoconvAdapter(
  env: InfoconvEnvironment,
  input: Record<string, string | undefined> = process.env,
): Promise<DataSourceAdapter> {
  if (env.INFOCONV_TRANSPORT !== "soap")
    throw new Error("Transporte Infoconv não implementado.");
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.PLAYWRIGHT_TEST === "1"
  ) {
    const { MockInfoconvAdapter } = await import("./mock-adapter");
    return new MockInfoconvAdapter();
  }
  const [
    { SoapInfoconvAdapter },
    { InfoconvSoapClient },
    { parseSoapEnvironment },
  ] = await Promise.all([
    import("./transports/soap/soap-adapter"),
    import("./transports/soap/soap-client"),
    import("./transports/soap/env"),
  ]);
  return new SoapInfoconvAdapter(
    new InfoconvSoapClient(parseSoapEnvironment(input), {
      enabled: env.INFOCONV_ENABLED === "true",
      timeoutMs: env.INFOCONV_TIMEOUT_MS,
    }),
  );
}
