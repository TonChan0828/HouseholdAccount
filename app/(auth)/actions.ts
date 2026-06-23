"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  redirect("/households");
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/households` },
  });

  if (error) {
    return { error: error.message };
  }

  // メール確認が必要なため、セッション未確立の前提で確認案内ページへ送る。
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

/**
 * 確認メールを再送信する。
 * アドレスの存在有無を漏らさないよう、結果に関わらず常に成功状態を返す（列挙攻撃対策）。
 */
export async function resendConfirmation(
  _prevState: ResendConfirmationState,
  formData: FormData,
): Promise<ResendConfirmationState> {
  const parsed = resetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/households` },
  });

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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

  const origin = await resolveOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

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

  await supabase.auth.signOut();
  redirect("/login?reset=success");
}
