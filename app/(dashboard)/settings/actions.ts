"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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
