import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/route-access";
import { createClient } from "@/lib/supabase/server";

/**
 * 認証メール（パスワード再設定／登録時のメール確認）リンクの着地点。
 * `code` をセッションに交換し、`next`（既定 /reset-password、メール確認は /households）へ送る。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // オープンリダイレクト対策: 外部 URL を弾き、同一オリジン内の相対パスのみ許可する。
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=reset_link_invalid`);
}
