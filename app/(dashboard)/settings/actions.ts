"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { accountDeletionSchema } from "@/lib/validations/account";
import { passwordUpdateSchema } from "@/lib/validations/auth";
import { profileSchema } from "@/lib/validations/profile";

export type ProfileActionState =
  | { error: string }
  | { success: true }
  | undefined;

export type PasswordActionState =
  | { error: string }
  | { success: true }
  | undefined;

// 成功時は signOut 後にリダイレクトするため success 状態は持たない。
export type AccountDeletionState = { error: string } | undefined;

/** 自分の表示名を更新する。成功時はリダイレクトせず成功状態を返す。 */
export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) {
    return { error: "表示名の更新に失敗しました" };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/** ログイン中ユーザーが自分のパスワードを変更する。成功時はリダイレクトせず成功状態を返す。 */
export async function changePassword(
  _prevState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
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
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: "パスワードの変更に失敗しました" };
  }

  return { success: true };
}

/**
 * 自分のアカウントを削除（退会）する。確認フレーズに登録メールアドレスの入力を要求し、
 * SECURITY DEFINER の RPC delete_own_account でアカウントと関連データを削除する。
 * 成功時はサインアウトして /login へリダイレクトする。
 */
export async function deleteAccount(
  _prevState: AccountDeletionState,
  formData: FormData,
): Promise<AccountDeletionState> {
  const parsed = accountDeletionSchema.safeParse({
    confirmText: formData.get("confirmText"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 確認フレーズが登録メールアドレスと一致しなければ実行しない（誤操作防止）。
  if (parsed.data.confirmText !== user.email) {
    return { error: "メールアドレスが一致しません" };
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return { error: "アカウントの削除に失敗しました" };
  }

  // セッションを破棄してログイン画面へ。ユーザーは既に削除済みのため失敗は無視する。
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
