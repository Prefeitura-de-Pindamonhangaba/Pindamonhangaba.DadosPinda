import "server-only";
import { parseKeycloakEnvironment } from "@/modules/auth/services/keycloak-config";

export function getLoginOptions() {
  return { keycloakEnabled: parseKeycloakEnvironment(process.env).enabled };
}
