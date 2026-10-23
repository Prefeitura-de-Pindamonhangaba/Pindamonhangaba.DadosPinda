import "server-only";
import {
  authorizeRequest,
  privateJson,
  readJson,
  RequestError,
  safeRequestError,
} from "@/shared/lib/security/request";
import { referenceMutationSchema } from "../schemas/reference-schema";
import {
  changeReferenceData,
  readReferenceData,
} from "@/shared/lib/references/server";
import { requirePageAccess } from "@/modules/auth/controllers/access-controller";

export async function loadReferencesPage() {
  return {
    principal: await requirePageAccess("references:manage"),
    data: await readReferenceData(),
  };
}
export async function handleReferences(request: Request) {
  try {
    const principal = await authorizeRequest(request, "references:manage");
    if (request.method === "GET") return privateJson(await readReferenceData());
    const parsed = referenceMutationSchema.safeParse(
      await readJson(request, 512_000),
    );
    if (!parsed.success)
      throw new RequestError(
        400,
        "Verifique os códigos, tipos e descrições informados.",
      );
    await changeReferenceData(parsed.data, principal.id);
    return privateJson({ message: "Domínios atualizados." });
  } catch (error) {
    return safeRequestError(error);
  }
}
