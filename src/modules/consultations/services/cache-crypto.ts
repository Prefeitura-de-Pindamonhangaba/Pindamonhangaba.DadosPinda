import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { INFOCONV_CACHE_NAMESPACE } from "@/modules/data-sources/infoconv/profile-schema";

export function cacheContext(key: string, obtainedAt: Date, expiresAt: Date) {
  return `${key}:${obtainedAt.toISOString()}:${expiresAt.toISOString()}`;
}

export function documentDigest(key: string, kind: string, document: string) {
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update(`${INFOCONV_CACHE_NAMESPACE}:${kind}:${document}`)
    .digest("hex");
}

export function encryptCache(key: string, context: string, value: unknown) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
    "base64",
  );
}

export function decryptCache(
  key: string,
  context: string,
  value: string,
): unknown {
  const content = Buffer.from(value, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    content.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(content.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(content.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}
