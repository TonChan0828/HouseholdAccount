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
import { groupDisplayNameSchema } from "@/lib/validations/profile";
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
  redirect("/dashboard");
}

/** アクティブグループを切り替える。所属していないグループは無視する。 */
export async function setActiveHousehold(formData: FormData): Promise<void> {
  const householdId = String(formData.get("household_id") ?? "");
  if (!householdId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 自分がメンバーであることを確認する。
  // RLS は同居メンバー全員の行を返すため、user_id で絞らないと複数行になり maybeSingle が失敗する。
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) {
    await setActiveHouseholdCookie(householdId);
    // ヘッダーのスイッチャーはどのページからでも呼ばれる。レイアウトごと
    // 再検証して、今いるページがその場で新グループのデータに更新されるようにする。
    revalidatePath("/", "layout");
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

export type LeaveHouseholdActionState = { error: string } | undefined;

/** owner がメンバーをグループから除外する。自分自身は対象外（脱退を使う）。 */
export async function removeMember(formData: FormData): Promise<void> {
  const householdId = String(formData.get("household_id") ?? "");
  const targetUserId = String(formData.get("user_id") ?? "");
  if (!householdId || !targetUserId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 自分自身は除外できない（脱退 leaveHousehold を使う）。
  if (targetUserId === user.id) {
    return;
  }

  // RLS の delete ポリシー（members_delete_owner_or_self）で owner 以外は弾かれる。
  // 除外されたメンバーのトランザクション等は household スコープのデータとして残す。
  await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", targetUserId);

  revalidatePath("/households");
}

/**
 * 自分のグループ毎の表示名（ニックネーム）を更新する。
 * 空文字を保存するとニックネームを解除し、グローバル表示名にフォールバックする。
 * RLS の members_update_owner は owner のみ UPDATE 可のため、自分の行の display_name
 * だけ更新する SECURITY DEFINER RPC set_member_display_name を使う（呼び出し元判定は関数内）。
 */
export async function updateGroupDisplayName(
  formData: FormData,
): Promise<void> {
  const householdId = String(formData.get("household_id") ?? "");
  if (!householdId) {
    return;
  }

  const parsed = groupDisplayNameSchema.safeParse({
    displayName: formData.get("display_name"),
  });
  if (!parsed.success) {
    return;
  }

  const supabase = await createClient();
  await supabase.rpc("set_member_display_name", {
    _household_id: householdId,
    _display_name: parsed.data.displayName,
  });

  // ヘッダー・メンバー一覧・メンバー別表示など表示名を出す全画面を再検証する。
  revalidatePath("/", "layout");
}

/** メンバーが自分でグループを脱退する。owner は委譲してからでないと脱退できない。 */
export async function leaveHousehold(
  _prevState: LeaveHouseholdActionState,
  formData: FormData,
): Promise<LeaveHouseholdActionState> {
  const householdId = String(formData.get("household_id") ?? "");
  if (!householdId) {
    return { error: "グループが指定されていません" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 自分のロールを確認する。owner は別メンバーへ委譲してからでないと脱退できない。
  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "このグループに参加していません" };
  }
  if (membership.role === "owner") {
    return {
      error: "オーナーは別のメンバーにオーナーを委譲してから脱退してください",
    };
  }

  // RLS の delete ポリシーで自分の行のみ削除できる。
  await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", user.id);

  // 脱退したグループがアクティブだった場合は Cookie を消す（getActiveHouseholdId が
  // 残りの所属グループへフォールバックする）。
  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value === householdId) {
    cookieStore.delete(ACTIVE_HOUSEHOLD_COOKIE);
  }

  revalidatePath("/", "layout");
  redirect("/households");
}

/** owner が同じグループの別メンバーへオーナーを委譲する（自分は member に降格）。 */
export async function transferOwnership(formData: FormData): Promise<void> {
  const householdId = String(formData.get("household_id") ?? "");
  const newOwnerId = String(formData.get("user_id") ?? "");
  if (!householdId || !newOwnerId) {
    return;
  }

  const supabase = await createClient();
  // 複数行の更新を原子的に行うため SECURITY DEFINER の RPC を使う。
  // owner 判定・後継者の所属確認は関数内で行う。
  await supabase.rpc("transfer_ownership", {
    _household_id: householdId,
    _new_owner: newOwnerId,
  });

  revalidatePath("/households");
}

/** owner がグループを削除する。子テーブル（メンバー・取引・カテゴリ・招待）は CASCADE で消える。 */
export async function deleteHousehold(formData: FormData): Promise<void> {
  const householdId = String(formData.get("household_id") ?? "");
  if (!householdId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 防御的に owner であることを確認する（RLS の delete ポリシーでも owner 以外は 0 行）。
  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.role !== "owner") {
    return;
  }

  // RLS の households_delete_owner で owner を強制。子テーブルは on delete cascade。
  await supabase.from("households").delete().eq("id", householdId);

  // 削除グループがアクティブだった場合は Cookie を消す
  // （getActiveHouseholdId が残りの所属グループへフォールバックする）。
  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value === householdId) {
    cookieStore.delete(ACTIVE_HOUSEHOLD_COOKIE);
  }

  revalidatePath("/", "layout");
  redirect("/households");
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
  redirect("/dashboard");
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
