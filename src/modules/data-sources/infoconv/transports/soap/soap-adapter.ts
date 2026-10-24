import {
  ConsultationError,
  type DataSourceAdapter,
  type DocumentKind,
} from "@/modules/consultations/models/consultation-types";
import { normalizeInfoconvProfile } from "../../profile-schema";
import { parseSoapResponse } from "./response-schema";
import type { SoapTransport } from "./soap-transport";

export class SoapInfoconvAdapter implements DataSourceAdapter {
  constructor(private readonly transport: SoapTransport) {}

  async consult(kind: DocumentKind, document: string) {
    try {
      const response = await this.transport.request(kind, document);
      return {
        data: normalizeInfoconvProfile(
          kind,
          document,
          parseSoapResponse(kind, document, response),
        ),
      };
    } catch (error) {
      if (error instanceof ConsultationError) throw error;
      throw new ConsultationError("unavailable");
    }
  }
}
