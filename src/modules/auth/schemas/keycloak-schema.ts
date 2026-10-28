import { z } from "zod";

export const keycloakSignInSchema = z.strictObject({
  provider: z.literal("keycloak"),
  callbackURL: z.literal("/"),
  errorCallbackURL: z.literal("/login?sso=error"),
});
