import "server-only";
import { getDatabase } from "@/shared/lib/db/client";
import { createReferenceRepository } from "@/modules/reference-data/models/reference-repository";
import {
  listReferences,
  mutateReferences,
} from "@/modules/reference-data/services/reference-service";
export function readReferenceData() {
  return listReferences(createReferenceRepository(getDatabase()));
}
export function changeReferenceData(input: unknown, actorId: string) {
  return mutateReferences(
    createReferenceRepository(getDatabase()),
    input,
    actorId,
  );
}
