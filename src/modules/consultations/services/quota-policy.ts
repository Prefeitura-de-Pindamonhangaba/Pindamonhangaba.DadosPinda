import { z } from "zod";
export function currentQuotaMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}
export const quotaApprovalSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  additional: z.number().int().min(0).max(1000000),
  reason: z.string().trim().min(10).max(500),
  acknowledgeAdditionalCharge: z.literal(true),
});
