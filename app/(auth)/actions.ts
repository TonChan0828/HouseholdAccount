"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/observability";
import { throwIfError } from "@/lib/queries/result";
import {
  consumeRateLimit,
  RATE_LIMIT_UNAVAILABLE_MESSAGE,
} from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/route-access";
import {
  loginSchema,
  passwordUpdateSchema,
  registerSchema,
  resetRequestSchema,
} from "@/lib/validations/auth";

export type AuthState = { error: string } | undefined;

export type PasswordResetRequestState =
  | { error: string }
  | { success: true }
  | undefined;

export type ResendConfirmationState =
  | { error: string }
  | { success: true }
  | undefined;

/** メール内リンクの着地点に使う絶対オリジンを解決する（本番は環境変数、無ければ request origin） */
async function resolveOrigin(): Promise<string> {
  const headerList = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL ?? headerList.get("origin") ?? "";
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const nextPath = safeNextPath(
    String(formData.get("next") ?? ""),
    "/households",
  );
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const rateLimit = await consumeRateLimit({
    bucket: "auth.login",
    subject: parsed.data.email,
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (rateLimit !== "allowed") {
    return {
      error: rateLimit === "unavailable"
        ? RATE_LIMIT_UNAVAILABLE_MESSAGE
        : "試行回数が多すぎます。しばらく待ってからお試しください",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  redirect(nextPath);
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const nextPath = safeNextPath(
    String(formData.get("next") ?? ""),
    "/households",
  );
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const rateLimit = await consumeRateLimit({
    bucket: "auth.signup",
    subject: parsed.data.email,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (rateLimit !== "allowed") {
    return {
      error: rateLimit === "unavailable"
        ? RATE_LIMIT_UNAVAILABLE_MESSAGE
        : "試行回数が多すぎます。しばらく待ってからお試しください",
    };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // メール確認が必要なため、セッション未確立の前提で確認案内ページへ送る。
  const verifyParams = new URLSearchParams({
    email: parsed.data.email,
    next: nextPath,
  });
  redirect(`/verify-email?${verifyParams}`);
}

/**
 * 確認メールを再送信する。
 * アドレスの存在有無を漏らさないよう、結果に関わらず常に成功状態を返す（列挙攻撃対策）。
 */
export async function resendConfirmation(
  _prevState: ResendConfirmationState,
  formData: FormData,
): Promise<ResendConfirmationState> {
  const nextPath = safeNextPath(
    String(formData.get("next") ?? ""),
    "/households",
  );
  const parsed = resetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  if (
    (await consumeRateLimit({
      bucket: "auth.confirmation_resend",
      subject: parsed.data.email,
      limit: 5,
      windowSeconds: 60 * 60,
    })) !== "allowed"
  ) {
    return { success: true };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();
  const result = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });
  if (result.error) {
    logServerError("auth.confirmation_resend.failed", result.error);
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  const result = await supabase.auth.signOut();
  throwIfError(result, "signOut");
  redirect("/?loggedout=1");
}

/**
 * パスワード再設定メールを送信する。
 * アドレスの存在有無を漏らさないよう、結果に関わらず常に成功状態を返す（列挙攻撃対策）。
 */
export async function requestPasswordReset(
  _prevState: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const parsed = resetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  if (
    (await consumeRateLimit({
      bucket: "auth.password_reset",
      subject: parsed.data.email,
      limit: 5,
      windowSeconds: 60 * 60,
    })) !== "allowed"
  ) {
    return { success: true };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();
  const result = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (result.error) {
    logServerError("auth.password_reset_request.failed", result.error);
  }

  return { success: true };
}

/**
 * リカバリーセッションを前提に新しいパスワードを設定する。
 * 成功後はサインアウトし、ログイン画面で再ログインしてもらう。
 */
export async function updatePassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordUpdateSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "再設定リンクの有効期限が切れています。もう一度お試しください",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: "パスワードの更新に失敗しました" };
  }

  const signOutResult = await supabase.auth.signOut();
  throwIfError(signOutResult, "signOutAfterPasswordReset");
  redirect("/login?reset=success");
}
