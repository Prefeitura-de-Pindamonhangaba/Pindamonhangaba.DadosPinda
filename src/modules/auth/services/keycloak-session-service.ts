import { z } from "zod";
import type { Role } from "../permissions";
import { keycloakAccountId } from "./keycloak-config";
import type { createAuthService } from "./auth-service";
import type { createKeycloakIdentityRepository } from "../models/keycloak-identity-repository";

type Authorization = { checkedAt: number; role: Role; name: string };
export function createKeycloakSessionService(
  auth: ReturnType<typeof createAuthService>,
  repository: ReturnType<typeof createKeycloakIdentityRepository>,
  now: () => number = Date.now,
) {
  const checks = new Map<string, Authorization>();
  const pending = new Map<string, Promise<Authorization | null>>();
  return {
    async getPrincipal(headers: Headers) {
      const current = await auth.api.getSession({ headers });
      if (!current) return null;
      const userId = current.user.id;
      const sessionId = current.session.id;
      const linked = await repository.principal(userId);
      if (!linked) return null;
      let authority = checks.get(sessionId);
      if (!authority || authority.checkedAt + 60_000 <= now()) {
        let check = pending.get(userId);
        if (!check) {
          check = (async () => {
            try {
              // O SDK renova os tokens e valida o novo ID token antes de sincronizar os papéis.
              const refreshed = await auth.api.refreshToken({
                headers,
                body: { accountId: linked.accountId },
              });
              if (!refreshed.idToken) throw new Error("ID token ausente.");
              const info = await auth.api.accountInfo({
                headers,
                query: { accountId: linked.accountId },
              });
              const verified = z
                .object({
                  iss: z.string(),
                  sub: z.string(),
                  pindaRole: z.enum(["viewer", "operator", "admin"]),
                  name: z.string(),
                })
                .safeParse(info.data);
              if (
                !verified.success ||
                keycloakAccountId(verified.data.iss, verified.data.sub) !==
                  linked.identityKey
              )
                throw new Error("Identidade institucional divergente.");
              return {
                checkedAt: now(),
                role: verified.data.pindaRole,
                name: verified.data.name,
              };
            } catch {
              await repository.revoke(userId);
              return null;
            } finally {
              pending.delete(userId);
            }
          })();
          pending.set(userId, check);
        }
        const verified = await check;
        if (!verified) {
          checks.delete(sessionId);
          return null;
        }
        if (checks.size >= 5000) checks.clear();
        checks.set(sessionId, verified);
        authority = verified;
      }
      // A autorização usa o resultado validado do Keycloak; o papel no banco é somente um espelho.
      return {
        id: userId,
        name: authority.name,
        role: authority.role,
        enabled: true,
      };
    },
  };
}
