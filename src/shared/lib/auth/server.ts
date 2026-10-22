import "server-only";
import { getDatabase } from "@/shared/lib/db/client";
import { parseAuthEnvironment } from "@/shared/lib/env";
import { createAuthService } from "@/modules/auth/services/auth-service";

let auth: ReturnType<typeof createAuthService> | undefined;

export function getAuth() {
  auth ??= createAuthService(getDatabase(), parseAuthEnvironment(process.env));
  return auth;
}
