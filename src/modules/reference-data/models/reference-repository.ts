import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { referenceType, referenceValue } from "./reference-schema";
import { auditEvent } from "@/modules/audit/models/audit-schema";
import type { ReferenceMutation } from "../schemas/reference-schema";

export function createReferenceRepository(database: PostgresJsDatabase) {
  return {
    async list() {
      return {
        types: await database
          .select()
          .from(referenceType)
          .orderBy(asc(referenceType.code)),
        values: await database
          .select()
          .from(referenceValue)
          .orderBy(asc(referenceValue.type), asc(referenceValue.code))
          .limit(5000),
      };
    },
    async mutate(input: ReferenceMutation, actorId: string) {
      await database.transaction(async (tx) => {
        switch (input.action) {
          case "save-type":
            await tx
              .insert(referenceType)
              .values(input.item)
              .onConflictDoUpdate({
                target: referenceType.code,
                set: { label: input.item.label },
              });
            break;
          case "delete-type":
            await tx
              .delete(referenceType)
              .where(eq(referenceType.code, input.code));
            break;
          case "save-value": {
            const { id, ...value } = input.item;
            if (id)
              await tx
                .update(referenceValue)
                .set(value)
                .where(eq(referenceValue.id, id));
            else
              await tx
                .insert(referenceValue)
                .values(value)
                .onConflictDoUpdate({
                  target: [referenceValue.type, referenceValue.code],
                  set: { label: value.label },
                });
            break;
          }
          case "delete-value":
            await tx
              .delete(referenceValue)
              .where(eq(referenceValue.id, input.id));
            break;
          case "import": {
            for (const type of [
              ...new Set(input.items.map((item) => item.type)),
            ])
              await tx
                .insert(referenceType)
                .values({ code: type, label: type })
                .onConflictDoNothing();
            for (const item of input.items)
              await tx
                .insert(referenceValue)
                .values(item)
                .onConflictDoUpdate({
                  target: [referenceValue.type, referenceValue.code],
                  set: { label: item.label },
                });
          }
        }
        await tx.insert(auditEvent).values({
          userId: actorId,
          actorId,
          action: `reference.${input.action}`,
        });
      });
    },
  };
}
