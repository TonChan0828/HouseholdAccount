/**
 * デモモードのインメモリ状態と純粋な操作ロジック。
 *
 * Supabase には一切アクセスせず、状態はメモリ上のみ。リロードで初期化される。
 * すべての操作はイミュータブル（新しい state を返す）で、ユニットテストで検証する。
 */

import type { MemberInfo } from "@/lib/members";
import type { CategoryInput } from "@/lib/validations/category";
import type { TransactionInput } from "@/lib/validations/transaction";
import type { Category, Transaction } from "@/types";

import { createSeedState } from "./seed";

export {
  DEMO_HOUSEHOLD_ID,
  DEMO_USER_ID,
  DEMO_PARTNER_ID,
} from "./seed";

export type DemoState = {
  household: { id: string; name: string; period_start_day: number };
  currentUserId: string;
  members: MemberInfo[];
  categories: Category[];
  transactions: Transaction[];
};

/** 収支にカテゴリ情報を join した表示用の行。 */
export type DemoTransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category_id: string | null;
  category: { name: string; color: string | null } | null;
};

/** seed から初期状態を組み立てる。 */
export function createDemoState(): DemoState {
  return createSeedState();
}

/** 収支を1件追加する（登録者は既定で currentUser）。 */
export function addTransaction(
  state: DemoState,
  input: TransactionInput,
  createdBy: string = state.currentUserId,
): DemoState {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    household_id: state.household.id,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    type: input.type,
    amount: input.amount,
    date: input.date,
    category_id: input.category_id ?? null,
    memo: input.memo || null,
  };
  return { ...state, transactions: [tx, ...state.transactions] };
}

/** 指定IDの収支を更新する。 */
export function editTransaction(
  state: DemoState,
  id: string,
  input: TransactionInput,
): DemoState {
  return {
    ...state,
    transactions: state.transactions.map((t) =>
      t.id === id
        ? {
            ...t,
            type: input.type,
            amount: input.amount,
            date: input.date,
            category_id: input.category_id ?? null,
            memo: input.memo || null,
          }
        : t,
    ),
  };
}

/** 指定IDの収支を削除する。 */
export function removeTransaction(state: DemoState, id: string): DemoState {
  return {
    ...state,
    transactions: state.transactions.filter((t) => t.id !== id),
  };
}

/** カスタムカテゴリを追加する（is_default は常に false）。 */
export function addCategory(
  state: DemoState,
  input: CategoryInput,
): DemoState {
  const category: Category = {
    id: crypto.randomUUID(),
    household_id: state.household.id,
    name: input.name,
    color: input.color,
    type: input.type,
    icon: null,
    is_default: false,
  };
  return { ...state, categories: [...state.categories, category] };
}

/** カスタムカテゴリを編集する。デフォルトカテゴリは対象外（no-op）。 */
export function editCategory(
  state: DemoState,
  id: string,
  input: CategoryInput,
): DemoState {
  return {
    ...state,
    categories: state.categories.map((c) =>
      c.id === id && !c.is_default
        ? { ...c, name: input.name, color: input.color, type: input.type }
        : c,
    ),
  };
}

/**
 * カスタムカテゴリを削除する。デフォルトカテゴリは対象外（no-op）。
 * 削除すると、参照していた収支は category_id=null（未分類）になる。
 */
export function removeCategory(state: DemoState, id: string): DemoState {
  const target = state.categories.find((c) => c.id === id);
  if (!target || target.is_default) {
    return state;
  }
  return {
    ...state,
    categories: state.categories.filter((c) => c.id !== id),
    transactions: state.transactions.map((t) =>
      t.category_id === id ? { ...t, category_id: null } : t,
    ),
  };
}

/** 収支にカテゴリ情報を join した行を返す（新しい日付順）。 */
export function selectTransactionRows(state: DemoState): DemoTransactionRow[] {
  const byId = new Map(state.categories.map((c) => [c.id, c]));
  return state.transactions.map((t) => {
    const cat = t.category_id ? byId.get(t.category_id) : undefined;
    return {
      id: t.id,
      amount: t.amount,
      type: t.type,
      date: t.date,
      memo: t.memo,
      created_by: t.created_by,
      category_id: t.category_id,
      category: cat ? { name: cat.name, color: cat.color } : null,
    };
  });
}
