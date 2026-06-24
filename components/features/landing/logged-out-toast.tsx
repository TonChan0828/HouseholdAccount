"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * ログアウト後に `/?loggedout=1` で LP に戻った際、「ログアウトしました」トーストを一度だけ表示する。
 * 表示後はクエリを除去してリロード時の再表示を防ぐ。
 */
export function LoggedOutToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (searchParams.get("loggedout") !== "1") return;

    firedRef.current = true;
    toast.success("ログアウトしました");
    router.replace("/");
  }, [router, searchParams]);

  return null;
}
