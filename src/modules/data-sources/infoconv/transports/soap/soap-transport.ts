import type { DocumentKind } from "@/modules/consultations/models/consultation-types";

export interface SoapTransport {
  request(kind: DocumentKind, document: string): Promise<unknown>;
}
