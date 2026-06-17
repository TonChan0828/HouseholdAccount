"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { CategoryActionState } from "@/app/(dashboard)/categories/actions";
import type { TransactionActionState } from "@/app/(dashboard)/transactions/actions";
import type { MemberInfo } from "@/lib/members";
import {
  addCategory,
  addTransaction,
  createDemoState,
  editCategory,
  editTransaction,
  removeCategory,
  removeTransaction,
  selectTransactionRows,
  type DemoState,
  type DemoTransactionRow,
} from "@/lib/demo/store";
import { categorySchema } from "@/lib/validations/category";
import { transactionSchema } from "@/lib/validations/transaction";
import type { Category } from "@/types";

type TransactionAction = (
  state: TransactionActionState,
  formData: FormData,
) => Promise<TransactionActionState>;

type CategoryAction = (
  state: CategoryActionState,
  formData: FormData,
) => Promise<CategoryActionState>;

type DemoContextValue = {
  household: DemoState["household"];
  currentUserId: string;
  members: MemberInfo[];
  categories: Category[];
  rows: DemoTransactionRow[];
  getRow: (id: string) => DemoTransactionRow | undefined;
  getCategory: (id: string) => Category | undefined;
  createTransactionAction: TransactionAction;
  updateTransactionAction: TransactionAction;
  deleteTransactionAction: (formData: FormData) => void;
  createCategoryAction: CategoryAction;
  updateCategoryAction: CategoryAction;
  deleteCategoryAction: (formData: FormData) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function parseTransaction(formData: FormData) {
  return transactionSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    category_id: formData.get("category_id"),
    memo: formData.get("memo"),
  });
}

function parseCategory(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    type: formData.get("type"),
  });
}

const INVALID = "入力内容を確認してください";

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // 初期 state はマウント時に1度だけ生成する（リロードで作り直され初期化される）。
  const [state, setState] = useState<DemoState>(createDemoState);

  const rows = useMemo(() => selectTransactionRows(state), [state]);

  const createTransactionAction = useCallback<TransactionAction>(
    async (_prev, formData) => {
      const parsed = parseTransaction(formData);
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? INVALID };
      }
      setState((s) => addTransaction(s, parsed.data));
      router.push("/demo/transactions");
      return undefined;
    },
    [router],
  );

  const updateTransactionAction = useCallback<TransactionAction>(
    async (_prev, formData) => {
      const id = String(formData.get("id") ?? "");
      if (!id) {
        return { error: "対象が指定されていません" };
      }
      const parsed = parseTransaction(formData);
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? INVALID };
      }
      setState((s) => editTransaction(s, id, parsed.data));
      router.push("/demo/transactions");
      return undefined;
    },
    [router],
  );

  const deleteTransactionAction = useCallback(
    (formData: FormData) => {
      const id = String(formData.get("id") ?? "");
      if (!id) return;
      setState((s) => removeTransaction(s, id));
      router.push("/demo/transactions");
    },
    [router],
  );

  const createCategoryAction = useCallback<CategoryAction>(
    async (_prev, formData) => {
      const parsed = parseCategory(formData);
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? INVALID };
      }
      setState((s) => addCategory(s, parsed.data));
      router.push("/demo/categories");
      return undefined;
    },
    [router],
  );

  const updateCategoryAction = useCallback<CategoryAction>(
    async (_prev, formData) => {
      const id = String(formData.get("id") ?? "");
      if (!id) {
        return { error: "対象が指定されていません" };
      }
      const parsed = parseCategory(formData);
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? INVALID };
      }
      setState((s) => editCategory(s, id, parsed.data));
      router.push("/demo/categories");
      return undefined;
    },
    [router],
  );

  const deleteCategoryAction = useCallback(
    (formData: FormData) => {
      const id = String(formData.get("id") ?? "");
      if (!id) return;
      setState((s) => removeCategory(s, id));
      router.push("/demo/categories");
    },
    [router],
  );

  const value = useMemo<DemoContextValue>(
    () => ({
      household: state.household,
      currentUserId: state.currentUserId,
      members: state.members,
      categories: state.categories,
      rows,
      getRow: (id) => rows.find((r) => r.id === id),
      getCategory: (id) => state.categories.find((c) => c.id === id),
      createTransactionAction,
      updateTransactionAction,
      deleteTransactionAction,
      createCategoryAction,
      updateCategoryAction,
      deleteCategoryAction,
    }),
    [
      state,
      rows,
      createTransactionAction,
      updateTransactionAction,
      deleteTransactionAction,
      createCategoryAction,
      updateCategoryAction,
      deleteCategoryAction,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error("useDemo は DemoProvider の内側で使ってください");
  }
  return ctx;
}
