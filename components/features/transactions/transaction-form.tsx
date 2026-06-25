"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { TransactionActionState } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateExpression } from "@/lib/amount-expression";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, TransactionType } from "@/types";

/** 入力が演算子を含む式かどうか（プレーン数値はプレビュー不要）。 */
function hasOperator(value: string): boolean {
  return /[+\-*/×÷]/.test(value.replace(/^\s*[-－]/, ""));
}

type TransactionAction = (
  state: TransactionActionState,
  formData: FormData,
) => Promise<TransactionActionState>;

type Props = {
  action: TransactionAction;
  categories: Category[];
  submitLabel: string;
  /** 「登録して続ける」ボタンを表示し、登録後もフォームに留まれるようにする（新規登録のみ） */
  enableContinue?: boolean;
  defaultValues?: {
    id?: string;
    type?: TransactionType;
    amount?: number;
    date?: string;
    category_id?: string | null;
    memo?: string | null;
  };
};

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TransactionForm({
  action,
  categories,
  submitLabel,
  enableContinue,
  defaultValues,
}: Props) {
  const [state, formAction, pending] = useActionState<
    TransactionActionState,
    FormData
  >(action, undefined);

  const [type, setType] = useState<TransactionType>(
    defaultValues?.type ?? "expense",
  );
  const [categoryId, setCategoryId] = useState<string>(
    defaultValues?.category_id ?? "",
  );
  const [savedCount, setSavedCount] = useState(0);
  // 金額欄に入力された式のプレビュー。null=非表示。
  const [amountPreview, setAmountPreview] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const lastOkKey = useRef<string | null>(null);

  // 「登録して続ける」成功のたびに、金額・メモ・カテゴリをクリアし金額欄へフォーカスする。
  // 日付・種別は維持（日付/メモ/金額は uncontrolled のため DOM から直接クリアする）。
  useEffect(() => {
    if (!state || !("ok" in state)) return;
    if (lastOkKey.current === state.key) return;
    lastOkKey.current = state.key;

    if (amountRef.current) amountRef.current.value = "";
    if (memoRef.current) memoRef.current.value = "";
    setCategoryId("");
    setAmountPreview(null);
    setSavedCount((n) => n + 1);
    amountRef.current?.focus();
  }, [state]);

  // 金額欄の入力からプレビュー文字列を算出する。
  // 演算子を含まないプレーン数値は非表示、評価不能なら「計算できません」。
  const updateAmountPreview = (value: string) => {
    if (!hasOperator(value)) {
      setAmountPreview(null);
      return;
    }
    const result = evaluateExpression(value);
    setAmountPreview(
      result === null ? "計算できません" : `= ${yen(Math.round(result))}`,
    );
  };

  const options = categories.filter(
    (c) => c.type === type || c.type === "both",
  );

  const selectType = (t: TransactionType) => {
    setType(t);
    // 種別を切り替えたら、新しい種別に存在しないカテゴリ選択はリセットする
    const stillValid = categories.some(
      (c) => c.id === categoryId && (c.type === t || c.type === "both"),
    );
    if (!stillValid) {
      setCategoryId("");
    }
  };

  return (
    <form action={formAction} className="space-y-5">
      {defaultValues?.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      <fieldset className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
        {(["expense", "income"] as const).map((t) => {
          const active = type === t;
          const Icon = t === "expense" ? TrendingDown : TrendingUp;
          return (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? t === "expense"
                    ? "bg-card font-bold text-expense shadow-soft"
                    : "bg-card font-bold text-income shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={active}
                onChange={() => selectType(t)}
                className="sr-only"
              />
              <Icon className="pointer-events-none size-4" aria-hidden />
              {t === "expense" ? "支出" : "収入"}
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="amount">金額</Label>
          <span className="text-xs text-muted-foreground">
            + − × ÷ で計算できます
          </span>
        </div>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-heading text-xl font-bold text-muted-foreground"
          >
            ¥
          </span>
          <Input
            ref={amountRef}
            id="amount"
            name="amount"
            type="text"
            inputMode="text"
            placeholder="1000"
            defaultValue={defaultValues?.amount ?? ""}
            required
            onChange={(e) => updateAmountPreview(e.target.value)}
            className="h-14 pl-10 font-heading text-2xl font-bold tabular-nums md:text-2xl"
          />
        </div>
        {amountPreview ? (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "font-heading text-lg font-bold tabular-nums",
              amountPreview === "計算できません"
                ? "text-muted-foreground"
                : "text-foreground",
            )}
          >
            {amountPreview}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">日付</Label>
        <Input
          id="date"
          name="date"
          type="date"
          defaultValue={defaultValues?.date ?? localToday()}
          required
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="flex items-center gap-2 text-sm leading-none font-medium select-none">
          カテゴリ
        </legend>
        <div className="flex flex-wrap gap-2">
          <label
            className={cn(
              "relative flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/60",
              categoryId === ""
                ? "border-primary bg-secondary font-medium text-secondary-foreground"
                : "border-border text-muted-foreground hover:bg-accent/60",
            )}
          >
            <input
              type="radio"
              name="category_id"
              value=""
              checked={categoryId === ""}
              onChange={() => setCategoryId("")}
              className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
            />
            未選択
          </label>
          {options.map((c) => {
            const active = categoryId === c.id;
            return (
              <label
                key={c.id}
                className={cn(
                  "relative flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/60",
                  active
                    ? "border-primary bg-secondary font-medium text-secondary-foreground"
                    : "border-border hover:bg-accent/60",
                )}
              >
                <input
                  type="radio"
                  name="category_id"
                  value={c.id}
                  checked={active}
                  onChange={() => setCategoryId(c.id)}
                  className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
                />
                <span
                  aria-hidden
                  className="pointer-events-none inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: c.color ?? "#999" }}
                />
                {c.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="memo">メモ</Label>
        <textarea
          ref={memoRef}
          id="memo"
          name="memo"
          rows={2}
          maxLength={200}
          defaultValue={defaultValues?.memo ?? ""}
          className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {state && "error" in state ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      {savedCount > 0 ? (
        <p className="text-sm text-income" role="status" aria-live="polite">
          {savedCount}件登録しました（続けて入力できます）
        </p>
      ) : null}

      <div className="space-y-2">
        <Button
          type="submit"
          className="h-11 w-full text-base shadow-soft"
          disabled={pending}
        >
          {pending ? "処理中..." : submitLabel}
        </Button>
        {enableContinue ? (
          <Button
            type="submit"
            name="_continue"
            value="1"
            variant="outline"
            className="h-11 w-full text-base"
            disabled={pending}
          >
            登録して続ける
          </Button>
        ) : null}
      </div>
    </form>
  );
}
