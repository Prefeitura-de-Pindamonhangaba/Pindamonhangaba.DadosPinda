import type { Role } from "../permissions";
export interface KeycloakIdentity {
  accountId: string;
  subject: string;
  role: Role;
  name: string;
  technicalEmail: string;
}
