"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  ACTIVE_HOUSEHOLD_COOKIE,
  setActiveHouseholdCookie,
} from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import {
  createHouseholdSchema,
  invitationLimitSchema,
  periodStartDaySchema,
} from "@/lib/validations/household";
import { cookies } from "next/headers";

/** 招待リンクの有効期限（発行から7日）。 */
const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type HouseholdActionState = { error: string } | undefined;
export type InvitationActionState =
  | { error: string }
  | { token: string }
  | undefined;

/** グループを新規作成し、作成したグループをアクティブにしてダッシュボードへ。 */
export async function createHousehold(
  _prevState: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const parsed = createHouseholdSchema.safeParse({ name: formData.get("name") });
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

  // ID をアプリ側で発番する。
  // AFTER INSERT トリガが作成者をメンバー登録する前に RETURNING（.select()）の
  // RLS SELECT チェックが走り弾かれるため、insert では行を返さない（return=minimal）。
  const householdId = randomUUID();
  const { error } = await supabase
    .from("households")
    .insert({ id: householdId, name: parsed.data.name, created_by: user.id });

  if (error) {
    return { error: "グループの作成に失敗しました" };
  }

  await setActiveHouseholdCookie(householdId);
  redirect("/");
}

/** アクティブグループを切り替える。所属していないグループは無視する。 */
export async function setActiveHousehold(formData: FormData): Promise<void> {
  const householdId = String(formData.get("household_id") ?? "");
  if (!householdId) {
    return;
  }

  const supabase = await createClient();
  // メンバーであることを確認（RLS により他グループは取得できない）。
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .maybeSingle();

  if (data) {
    await setActiveHouseholdCookie(householdId);
    revalidatePath("/households");
    revalidatePath("/");
  }
}

/** owner が招待リンク（オープン・人数上限つき）を発行する。 */
export async function createInvitation(
  _prevState: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const householdId = String(formData.get("household_id") ?? "");
  if (!householdId) {
    return { error: "グループが指定されていません" };
  }

  const parsed = invitationLimitSchema.safeParse({
    maxUses: formData.get("max_uses"),
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

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

  // RLS の insert ポリシーで owner 以外は弾かれる。
  const { error } = await supabase.from("household_invitations").insert({
    household_id: householdId,
    token,
    created_by: user.id,
    max_uses: parsed.data.maxUses,
    expires_at: expiresAt,
  });

  if (error) {
    return { error: "招待リンクの発行に失敗しました（オーナーのみ発行できます）" };
  }

  revalidatePath("/households");
  return { token };
}

/** owner が発行済み招待リンクの人数上限を変更する。 */
export async function updateInvitation(formData: FormData): Promise<void> {
  const invitationId = String(formData.get("invitation_id") ?? "");
  if (!invitationId) {
    return;
  }

  const parsed = invitationLimitSchema.safeParse({
    maxUses: formData.get("max_uses"),
  });
  if (!parsed.success) {
    return;
  }

  const supabase = await createClient();
  // RLS の update ポリシーで owner 以外は弾かれる。
  await supabase
    .from("household_invitations")
    .update({ max_uses: parsed.data.maxUses })
    .eq("id", invitationId);

  revalidatePath("/households");
}

/** owner が月の区切りの開始日（period_start_day）を変更する。 */
export async function setPeriodStartDay(formData: FormData): Promise<void> {
  const householdId = String(formData.get("household_id") ?? "");
  if (!householdId) {
    return;
  }

  const parsed = periodStartDaySchema.safeParse({
    periodStartDay: formData.get("period_start_day"),
  });
  if (!parsed.success) {
    return;
  }

  const supabase = await createClient();
  // RLS の update ポリシーで owner 以外は弾かれる。
  await supabase
    .from("households")
    .update({ period_start_day: parsed.data.periodStartDay })
    .eq("id", householdId);

  revalidatePath("/households");
  revalidatePath("/transactions");
}

/** owner が招待リンクを失効（削除）する。 */
export async function revokeInvitation(formData: FormData): Promise<void> {
  const invitationId = String(formData.get("invitation_id") ?? "");
  if (!invitationId) {
    return;
  }

  const supabase = await createClient();
  // RLS の delete ポリシーで owner 以外は弾かれる。
  await supabase.from("household_invitations").delete().eq("id", invitationId);

  revalidatePath("/households");
}

/** 招待リンクの参加を確定する。成功時はそのグループをアクティブにしてダッシュボードへ。 */
export async function acceptInvitation(
  _prevState: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const token = String(formData.get("token") ?? "");
  if (!token) {
    return { error: "招待リンクが正しくありません" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("accept_invitation", {
    _token: token,
  });

  if (error || !data) {
    return { error: invitationErrorMessage(error?.message) };
  }

  await setActiveHouseholdCookie(data);
  redirect("/");
}

/** accept_invitation 関数が投げる英語メッセージを日本語に変換する。 */
function invitationErrorMessage(message?: string): string {
  if (!message) {
    return "このグループに参加できませんでした";
  }
  if (message.includes("not found")) {
    return "招待リンクが無効です";
  }
  if (message.includes("expired")) {
    return "この招待リンクは有効期限が切れています";
  }
  if (message.includes("usage limit")) {
    return "この招待リンクは参加上限に達しています";
  }
  return "このグループに参加できませんでした";
}

/** 現在アクティブな household_id を Cookie から読む（UI のハイライト用）。 */
export async function getActiveHouseholdIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value ?? null;
}
