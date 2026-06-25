import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * 当期分の定期収支を（未生成なら）生成する。
 *
 * SECURITY DEFINER 関数 `generate_due_recurring` は冪等（ON CONFLICT DO NOTHING）なので、
 * メンバーがアプリを開くたびに呼んでも二重登録は起きない。`cache()` でラップして
 * 同一リクエスト内では一度だけ実行する。生成された収支は同一描画のデータ取得に反映される。
 *
 * ダッシュボード／収支一覧の Server Component から、household 解決後・データ取得前に await する。
 */
export const ensureRecurringGenerated = cache(
  async (householdId: string): Promise<void> => {
    const supabase = await createClient();
    await supabase.rpc("generate_due_recurring", {
      _household_id: householdId,
    });
  },
);
