import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** service-role を使う管理用クライアント。Cron など明示的なサーバー処理だけで使う。 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
