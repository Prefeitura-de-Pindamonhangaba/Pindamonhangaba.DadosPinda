import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { X509Certificate } from "node:crypto";
import { createSecureContext, type ConnectionOptions } from "node:tls";

export type InfoconvCertificateFormat = "auto" | "pem" | "pfx";
export interface InfoconvCertificateConfiguration {
  certificatePath: string;
  format: InfoconvCertificateFormat;
  passphrase: string;
  caPath?: string;
}

export class InfoconvCertificateError extends Error {}

export async function loadInfoconvTlsOptions(
  config: InfoconvCertificateConfiguration,
  now = new Date(),
): Promise<ConnectionOptions> {
  const load = async (path: string, variable: string) => {
    try {
      return await readFile(path);
    } catch {
      throw new InfoconvCertificateError(
        `${variable}: arquivo ausente ou sem permissão de leitura. Confira o caminho e INFOCONV_CERTIFICATES_DIR no Docker.`,
      );
    }
  };
  const certificate = await load(
    config.certificatePath,
    "INFOCONV_CERTIFICATE_PATH",
  );
  const ca = config.caPath
    ? await load(config.caPath, "INFOCONV_CA_PATH")
    : undefined;
  const format =
    config.format === "auto"
      ? [".pfx", ".p12"].includes(extname(config.certificatePath).toLowerCase())
        ? "pfx"
        : "pem"
      : config.format;
  try {
    if (format === "pem") {
      const identity = new X509Certificate(certificate);
      if (
        Date.parse(identity.validFrom) > now.getTime() ||
        Date.parse(identity.validTo) <= now.getTime()
      )
        throw new InfoconvCertificateError(
          "Certificado Infoconv fora do período de validade.",
        );
    }
    const options: ConnectionOptions = {
      ...(format === "pfx"
        ? { pfx: certificate }
        : { cert: certificate, key: certificate }),
      passphrase: config.passphrase,
      ca,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    };
    // O runtime abre o PKCS#12 diretamente; nenhuma chave é extraída para disco.
    createSecureContext(options);
    return options;
  } catch (error) {
    if (error instanceof InfoconvCertificateError) throw error;
    throw new InfoconvCertificateError(
      "Certificado Infoconv inválido: verifique o formato PEM/PFX, a chave privada, a cadeia e INFOCONV_CERTIFICATE_PASSPHRASE.",
    );
  }
}
