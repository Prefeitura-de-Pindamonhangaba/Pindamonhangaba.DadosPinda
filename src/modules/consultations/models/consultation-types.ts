export type DocumentKind = "cpf" | "cnpj";
export type ProfileData = Record<
  string,
  string | string[] | Record<string, string>[]
>;
export type ConsultationResult = {
  id: string;
  batchId: string;
  kind: DocumentKind;
  document: string;
  status: "success" | "not_found" | "unavailable";
  origin: "cache" | "serpro" | "mock";
  obtainedAt: string;
  expiresAt?: string;
  data: ProfileData;
  message?: string;
  proof?: string;
};
export interface DataSourceAdapter {
  readonly isMock?: boolean;
  consult(
    kind: DocumentKind,
    document: string,
  ): Promise<{ data: ProfileData; mock?: boolean }>;
}
export class ConsultationError extends Error {
  constructor(
    public readonly code:
      | "unavailable"
      | "not_found"
      | "invalid_response"
      | "rate_limit"
      | "monthly_limit"
      | "forbidden",
  ) {
    super(code);
  }
}
