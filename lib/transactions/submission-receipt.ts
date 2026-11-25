import { z } from "zod";

export const submissionReceipt = z.object({
  id: z.string().uuid(),
  warnings: z.array(z.string()),
});

export const transactionDeletionCookie = "transaction_deletion_receipt";

export const transactionUndoReceipt = z.object({
  id: z.string().uuid(),
  expiresAt: z.iso.datetime({ offset: true }),
});

export function parseUndoReceipt(cookie: string | undefined) {
  if (!cookie) return null;
  try {
    const result = transactionUndoReceipt.safeParse(JSON.parse(cookie));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
