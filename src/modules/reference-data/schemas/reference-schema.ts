import { z } from "zod";
export const referenceTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z\d_]{1,40}$/),
  label: z.string().trim().min(1).max(120),
});
export const referenceValueSchema = z.object({
  id: z.uuid().optional(),
  type: z.string().regex(/^[A-Z\d_]{1,40}$/),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z\d_.-]{1,40}$/),
  label: z.string().trim().min(1).max(250),
});
export const referenceMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-type"), item: referenceTypeSchema }),
  z.object({
    action: z.literal("delete-type"),
    code: referenceTypeSchema.shape.code,
  }),
  z.object({ action: z.literal("save-value"), item: referenceValueSchema }),
  z.object({ action: z.literal("delete-value"), id: z.uuid() }),
  z.object({
    action: z.literal("import"),
    items: z
      .array(referenceValueSchema.omit({ id: true }))
      .min(1)
      .max(2000),
  }),
]);
export type ReferenceMutation = z.infer<typeof referenceMutationSchema>;
