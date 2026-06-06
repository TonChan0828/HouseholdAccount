import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/** 認証不要（未ログインでもアクセス可）なパスの接頭辞 */
const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * リクエストごとに Supabase セッションを更新し、認証状態に応じてリダイレクトする。
 * `middleware.ts` から呼び出す。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // createServerClient と getUser() の間にコードを挟まないこと（セッションずれの原因になる）。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 未ログインで保護ルートにアクセス → ログインへ
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ログイン済みで認証ページにアクセス → グループ選択へ
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/households";
    return NextResponse.redirect(url);
  }

  // 重要: supabaseResponse をそのまま返すこと（Cookie の同期が崩れるとセッションが切れる）。
  return supabaseResponse;
}
