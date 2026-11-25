"use client";

import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createTransaction,
  updateTransaction,
} from "@/app/(dashboard)/transactions/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MemberInfo } from "@/lib/members";
import type { CategoryOption } from "@/lib/queries/categories";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types";

import { ReflectToGroups } from "./reflect-to-groups.client";
import { TransactionForm } from "./transaction-form";

/** 編集ダイアログを開くのに必要な値。すべて一覧・カレンダー等で取得済み。 */
export type DialogTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  category_id: string | null;
  memo: string | null;
  created_by: string;
  /** 名義人（代理入力。spec 41）。null なら入力者本人が名義人。 */
  on_behalf_of: string | null;
  is_shared: boolean;
};

type Target = { mode: "create" } | { mode: "edit"; transaction: DialogTransaction };

type ContextValue = {
  openCreate: () => void;
  openEdit: (transaction: DialogTransaction) => void;
};

const TransactionDialogContext = createContext<ContextValue | null>(null);

function useTransactionDialog(): ContextValue {
  const context = useContext(TransactionDialogContext);
  if (!context) {
    throw new Error(
      "収支ダイアログのトリガーは TransactionDialogProvider の内側で使う",
    );
  }
  return context;
}

type ProviderProps = {
  categories: CategoryOption[];
  household?: { id: string; name: string };
  /** 反映先候補（現在のグループを除く自分の所属グループ）。空なら反映UIを出さない。 */
  otherHouseholds: { id: string; name: string }[];
  /** グループの全メンバー。2人以上なら名義人セレクトを出す（spec 41）。 */
  members?: MemberInfo[];
  /** ログイン中ユーザー。名義人セレクトの既定値。 */
  currentUserId?: string;
  children: ReactNode;
};

/**
 * 収支の追加・編集ダイアログ（spec 40）。
 *
 * ダイアログはページに1つだけマウントし、対象は state で差し替える。
 * 行ごとに複製すると `categories` が RSC ペイロードに行数ぶん重複するため。
 * 開くのに必要な値はすべて呼び出し元のページが取得済みなので、
 * 「開く」操作でサーバー往復は発生しない。
 */
export function TransactionDialogProvider({
  categories,
  household,
  otherHouseholds,
  members,
  currentUserId,
  children,
}: ProviderProps) {
  const [target, setTarget] = useState<Target | null>(null);

  const value = useMemo<ContextValue>(
    () => ({
      openCreate: () => setTarget({ mode: "create" }),
      openEdit: (transaction) => setTarget({ mode: "edit", transaction }),
    }),
    [],
  );

  const close = useCallback(() => setTarget(null), []);

  const editing = target?.mode === "edit" ? target.transaction : null;

  return (
    <TransactionDialogContext.Provider value={value}>
      {children}
      <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
        {target ? (
          <DialogContent
            data-testid="transaction-dialog"
            className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          >
            <DialogHeader className="shrink-0 px-4 py-4 pr-12">
              <DialogTitle>
                {editing ? "収支を編集" : "収支を追加"}
              </DialogTitle>
            </DialogHeader>

            <TransactionForm
              // 対象が変わったらフォームの状態（種別・カテゴリ等）を作り直す
              key={editing?.id ?? "new"}
              action={editing ? updateTransaction : createTransaction}
              categories={categories}
              household={household}
              submitLabel={editing ? "更新する" : "登録する"}
              dialog
              onSuccess={close}
              // 新規登録は閉じずに連続入力できるようにする（ページ版と同じ導線）
              enableContinue={!editing}
              showReceiptScan={!editing}
              // 新規登録は「登録と同時に他グループへコピー」を出す。
              // 編集は同時反映を持たないため、下の後追い反映（ReflectToGroups）に任せる。
              otherHouseholds={editing ? undefined : otherHouseholds}
              members={members}
              currentUserId={currentUserId}
              defaultValues={editing ?? undefined}
              afterForm={editing ? (
                <div className="mt-4 space-y-4">
                  {editing.amount >= 0 && otherHouseholds.length > 0 ? (
                    <ReflectToGroups
                      transactionId={editing.id}
                      otherHouseholds={otherHouseholds}
                    />
                  ) : null}
                  <div className="border-t pt-3 text-center">
                    <Link
                      href={`/transactions/${editing.id}/edit`}
                      className={buttonVariants({ variant: "link", size: "sm" })}
                    >
                      編集ページを開く（削除はこちら）
                    </Link>
                  </div>
                </div>
              ) : null}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </TransactionDialogContext.Provider>
  );
}

/** 一覧行などから編集ダイアログを開くアイコンボタン。 */
export function EditTransactionButton({
  transaction,
  className,
}: {
  transaction: DialogTransaction;
  className?: string;
}) {
  const { openEdit } = useTransactionDialog();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="編集"
      onClick={() => openEdit(transaction)}
      className={cn(
        "size-8 text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Pencil className="size-4" aria-hidden />
    </Button>
  );
}

/**
 * 行全体を編集ダイアログのトリガーにするラッパー。
 * カレンダーの明細のように、アイコンではなく行そのものをタップさせたい場所で使う。
 */
export function EditTransactionArea({
  transaction,
  className,
  children,
}: {
  transaction: DialogTransaction;
  className?: string;
  children: ReactNode;
}) {
  const { openEdit } = useTransactionDialog();

  return (
    <button
      type="button"
      aria-label="編集"
      onClick={() => openEdit(transaction)}
      className={cn("block w-full text-left", className)}
    >
      {children}
    </button>
  );
}

/** ページヘッダーから追加ダイアログを開くボタン。 */
export function NewTransactionButton({ className }: { className?: string }) {
  const { openCreate } = useTransactionDialog();

  return (
    <Button type="button" size="sm" onClick={openCreate} className={className}>
      <Plus className="size-4" aria-hidden />
      収支を追加
    </Button>
  );
}
