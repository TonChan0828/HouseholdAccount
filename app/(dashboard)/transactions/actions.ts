"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ExistingCategory } from "@/lib/import/excel";
import {
  getUserHouseholds,
  requireDashboardContext,
  type ServerClient,
} from "@/lib/household";
import {
  buildMirrorRows,
  type MirrorSource,
} from "@/lib/transactions/mirror";
import { transactionSchema } from "@/lib/validations/transaction";

export type TransactionActionState =
  | { error: string }
  | { ok: true; key: string }
  | undefined;

/** 後追い反映（reflectTransaction）の結果 state。 */
export type ReflectActionState =
  | { ok: true; count: number }
  | { error: string }
  | undefined;

function parse(formData: FormData) {
  return transactionSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    category_id: formData.get("category_id"),
    memo: formData.get("memo"),
  });
}

/** FormData から反映先グループ ID 群を取り出す（空・重複を除く）。 */
function readReflectIds(formData: FormData): string[] {
  const ids = formData
    .getAll("reflect_household_ids")
    .map((v) => String(v))
    .filter((v) => v.length > 0);
  return [...new Set(ids)];
}

/** カテゴリ id から名前を引く（未指定・不明なら null）。反映時の名前照合に使う。 */
async function getCategoryName(
  supabase: ServerClient,
  categoryId: string | null | undefined,
): Promise<string | null> {
  if (!categoryId) {
    return null;
  }
  const { data } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  return data?.name ?? null;
}

/**
 * 収支を反映先グループへ一回限りコピーする。
 *
 * - 反映先は本人の所属グループのみに絞る（反映元グループ自身は除外）。クライアントを信用しない。
 * - 反映先グループのカテゴリを取得し、名前+type 一致で `category_id` を解決（無ければ null）。
 * - RLS の INSERT ポリシー（is_household_member ∧ created_by = self）を満たすため SECURITY DEFINER 不要。
 *
 * @returns 反映した件数。DB エラー時は例外を投げる。
 */
async function mirrorTransaction(
  supabase: ServerClient,
  userId: string,
  sourceHouseholdId: string,
  source: MirrorSource,
  requestedIds: string[],
): Promise<number> {
  const memberships = await getUserHouseholds();
  const memberIds = new Set(memberships.map((h) => h.id));
  const validIds = requestedIds.filter(
    (id) => id !== sourceHouseholdId && memberIds.has(id),
  );
  if (validIds.length === 0) {
    return 0;
  }

  const { data: cats, error: catError } = await supabase
    .from("categories")
    .select("id, name, type, household_id")
    .in("household_id", validIds);
  if (catError) {
    throw new Error("カテゴリの取得に失敗しました");
  }

  const byHousehold = new Map<string, ExistingCategory[]>();
  for (const c of cats ?? []) {
    const arr = byHousehold.get(c.household_id) ?? [];
    arr.push({ id: c.id, name: c.name, type: c.type });
    byHousehold.set(c.household_id, arr);
  }

  const rows = buildMirrorRows(
    source,
    userId,
    validIds.map((id) => ({
      householdId: id,
      categories: byHousehold.get(id) ?? [],
    })),
  );

  const { error: insertError } = await supabase.from("transactions").insert(rows);
  if (insertError) {
    throw new Error("反映に失敗しました");
  }
  return rows.length;
}

/** 収支を新規登録する。登録者と household を自動付与。 */
export async function createTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { user, householdId, supabase } = await requireDashboardContext();

  const { type, amount, date, category_id, memo } = parsed.data;
  const { error } = await supabase.from("transactions").insert({
    household_id: householdId,
    created_by: user.id,
    type,
    amount,
    date,
    category_id: category_id ?? null,
    memo: memo || null,
  });

  if (error) {
    return { error: "収支の登録に失敗しました" };
  }

  // 反映先グループが選択されていれば他グループへも一回限りでコピーする。
  // 反映の失敗は本体の登録を巻き戻さず、状態として通知する。
  const reflectIds = readReflectIds(formData);
  if (reflectIds.length > 0) {
    try {
      const categoryName = await getCategoryName(supabase, category_id);
      await mirrorTransaction(
        supabase,
        user.id,
        householdId,
        { type, amount, date, categoryName, memo: memo || null },
        reflectIds,
      );
    } catch {
      return {
        error: "他のグループへの反映に失敗しました（収支自体は登録されました）",
      };
    }
  }

  revalidatePath("/transactions");

  // 「登録して続ける」場合はフォームに留まれるよう成功状態を返す。
  // key は連続成功のたびに変わり、クライアント側のフォームリセットを毎回トリガーする。
  if (formData.get("_continue") === "1") {
    return { ok: true, key: crypto.randomUUID() };
  }

  redirect("/transactions");
}

/** 収支を編集する（RLS に加えてアクティブグループでもスコープする多層防御）。 */
export async function updateTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "対象が指定されていません" };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { householdId, supabase } = await requireDashboardContext();

  const { type, amount, date, category_id, memo } = parsed.data;
  const { data, error } = await supabase
    .from("transactions")
    .update({
      type,
      amount,
      date,
      category_id: category_id ?? null,
      memo: memo || null,
    })
    .eq("id", id)
    .eq("household_id", householdId)
    .select("id");

  if (error) {
    return { error: "収支の更新に失敗しました" };
  }
  if (!data || data.length === 0) {
    return { error: "対象の収支が見つかりません" };
  }

  revalidatePath("/transactions");
  redirect("/transactions");
}

/** 収支を削除する（RLS に加えてアクティブグループでもスコープする多層防御）。 */
export async function deleteTransaction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }

  const { householdId, supabase } = await requireDashboardContext();

  await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);

  revalidatePath("/transactions");
  redirect("/transactions");
}

/** 既存の収支を、選択した他グループへ後追いで一回限りコピーする。 */
export async function reflectTransaction(
  _prevState: ReflectActionState,
  formData: FormData,
): Promise<ReflectActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "対象が指定されていません" };
  }

  const reflectIds = readReflectIds(formData);
  if (reflectIds.length === 0) {
    return { error: "反映先のグループを選択してください" };
  }

  const { user, householdId, supabase } = await requireDashboardContext();

  // 反映元はアクティブグループでスコープし、登録者本人のみ反映できる。
  const { data: tx } = await supabase
    .from("transactions")
    .select("type, amount, date, category_id, memo, created_by")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!tx || tx.created_by !== user.id) {
    return { error: "対象の収支が見つかりません" };
  }

  try {
    const categoryName = await getCategoryName(supabase, tx.category_id);
    const count = await mirrorTransaction(
      supabase,
      user.id,
      householdId,
      {
        type: tx.type,
        amount: tx.amount,
        date: tx.date,
        categoryName,
        memo: tx.memo,
      },
      reflectIds,
    );
    if (count === 0) {
      return { error: "反映先のグループが見つかりません" };
    }
    revalidatePath("/transactions");
    return { ok: true, count };
  } catch {
    return { error: "反映に失敗しました" };
  }
}
