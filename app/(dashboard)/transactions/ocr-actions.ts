"use server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/** ブラウザ内 OCR の開始頻度を、ユーザー単位の共有カウンターで制限する。 */
export async function authorizeReceiptScan(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  return consumeRateLimit({
    bucket: "ocr.start",
    subject: user.id,
    limit: 10,
    windowSeconds: 10 * 60,
    includeIp: false,
  });
}
