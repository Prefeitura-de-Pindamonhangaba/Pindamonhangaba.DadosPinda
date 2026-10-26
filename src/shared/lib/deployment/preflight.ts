import { readFile } from "node:fs/promises";
import { createSecureContext } from "node:tls";
import { parseInfoconvEnvironment } from "@/modules/data-sources/infoconv/env";
import { parseSoapEnvironment } from "@/modules/data-sources/infoconv/transports/soap/env";

export async function checkIntegrationConfiguration(
  input: Record<string, string | undefined>,
) {
  if (input.INFOCONV_ENABLED !== "true") {
    if (input.INFOCONV_ENABLED && input.INFOCONV_ENABLED !== "false")
      throw new Error("INFOCONV_ENABLED: utilize true ou false.");
    return;
  }
  const common = parseInfoconvEnvironment(input);
  const soap = parseSoapEnvironment(input);
  if (common.INFOCONV_CACHE_KEY === common.INFOCONV_AUDIT_KEY)
    throw new Error(
      "INFOCONV_CACHE_KEY e INFOCONV_AUDIT_KEY devem ser independentes.",
    );
  const load = async (path: string, variable: string) => {
    try {
      return await readFile(path);
    } catch {
      throw new Error(
        `${variable}: arquivo ausente ou sem permissão de leitura no container. Confira INFOCONV_CERTIFICATES_DIR.`,
      );
    }
  };
  const certificate = await load(
    soap.INFOCONV_CERTIFICATE_PATH,
    "INFOCONV_CERTIFICATE_PATH",
  );
  const ca = soap.INFOCONV_CA_PATH
    ? await load(soap.INFOCONV_CA_PATH, "INFOCONV_CA_PATH")
    : undefined;
  try {
    createSecureContext({
      cert: certificate,
      key: certificate,
      passphrase: soap.INFOCONV_CERTIFICATE_PASSPHRASE,
      ca,
    });
  } catch {
    throw new Error(
      "Certificado Infoconv inválido: verifique PEM, chave privada, cadeia e INFOCONV_CERTIFICATE_PASSPHRASE.",
    );
  }
}
