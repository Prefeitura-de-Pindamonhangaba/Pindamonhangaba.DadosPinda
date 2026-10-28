import { loadInfoconvTlsOptions } from "@/modules/data-sources/infoconv/certificate";
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
  await loadInfoconvTlsOptions({
    certificatePath: soap.INFOCONV_CERTIFICATE_PATH,
    format: soap.INFOCONV_CERTIFICATE_FORMAT,
    passphrase: soap.INFOCONV_CERTIFICATE_PASSPHRASE,
    caPath: soap.INFOCONV_CA_PATH,
  });
}
