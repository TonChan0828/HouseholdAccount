"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { TransactionActionState } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import { isIsoCalendarDate } from "@/lib/period";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateExpression } from "@/lib/amount-expression";
import { yen } from "@/lib/format";
import type { MemberInfo } from "@/lib/members";
import { localToday } from "@/lib/period";
import type { CategoryOption } from "@/lib/queries/categories";
import type { ParsedReceipt } from "@/lib/receipt/parse-receipt";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types";

import { ReceiptScanButton } from "./receipt-scan-button.client";

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
  categories: CategoryOption[];
  submitLabel: string;
  /** 「登録して続ける」ボタンを表示し、登録後もフォームに留まれるようにする（新規登録のみ） */
  enableContinue?: boolean;
  /** ダイアログ内での利用（spec 40）。Server Action がページ遷移せず成功状態を返す */
  dialog?: boolean;
  /** 保存に成功したときに呼ばれる（ダイアログを閉じるのに使う） */
  onSuccess?: () => void;
  /** レシートOCRの導線を出すか。編集ダイアログでは不要なので false にできる */
  showReceiptScan?: boolean;
  /** 反映先候補（反映元を除く自分の所属グループ）。渡すと「他のグループにも反映」UI を表示 */
  otherHouseholds?: { id: string; name: string }[];
  /** グループの全メンバー。2人以上のときだけ名義人セレクトを表示する（spec 41） */
  members?: MemberInfo[];
  /** ログイン中ユーザー。名義人セレクトの既定値に使う */
  currentUserId?: string;
  defaultValues?: {
    id?: string;
    type?: TransactionType;
    amount?: number;
    date?: string;
    category_id?: string | null;
    memo?: string | null;
    on_behalf_of?: string | null;
    is_shared?: boolean;
  };
};

export function TransactionForm({
  action,
  categories,
  submitLabel,
  enableContinue,
  dialog,
  onSuccess,
  showReceiptScan = true,
  otherHouseholds,
  members,
  currentUserId,
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
  // 反映先グループの選択（チェックされた household_id 群）。
  const [reflectIds, setReflectIds] = useState<string[]>([]);
  // 名義人（代理入力。spec 41）。既定は自分で、他メンバーを選ぶと代理入力になる。
  const [onBehalfOf, setOnBehalfOf] = useState<string>(
    defaultValues?.on_behalf_of ?? currentUserId ?? "",
  );
  // 精算対象（割り勘）。支出のときのみ UI を表示・送信する。
  const [isShared, setIsShared] = useState<boolean>(
    defaultValues?.is_shared ?? false,
  );
  const [savedCount, setSavedCount] = useState(0);
  // 金額欄に入力された式のプレビュー。null=非表示。
  const [amountPreview, setAmountPreview] = useState<string | null>(null);

  // 金額・日付・メモは制御入力にする。React は Server Action 送信後にフォームを
  // 自動リセットするため、uncontrolled のままだと保存に失敗したときに入力が消える。
  const [amount, setAmount] = useState<string>(
    defaultValues?.amount !== undefined ? String(defaultValues.amount) : "",
  );
  const [date, setDate] = useState<string>(defaultValues?.date ?? localToday());
  const [memo, setMemo] = useState<string>(defaultValues?.memo ?? "");

  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dateRef.current?.setCustomValidity(date && !isIsoCalendarDate(date)
      ? "実在する日付を YYYY-MM-DD 形式で入力してください" : "");
  }, [date]);
  const lastOkKey = useRef<string | null>(null);
  // 直前に押された送信ボタンが「登録して続ける」だったか。
  // 成功後にフォームをリセットするか、ダイアログを閉じるかの分岐に使う。
  const continueSubmit = useRef(false);
  // 成功のたびに、「登録して続ける」なら金額・メモ・カテゴリをクリアし金額欄へフォーカス、
  // そうでなければ onSuccess（ダイアログを閉じる）を呼ぶ。日付・種別は維持する。
  // 名義人も維持する（他人の分をまとめて入力するのが代理入力の主用途のため。spec 41）。
  useEffect(() => {
    if (!state || !("ok" in state)) return;
    if (lastOkKey.current === state.key) return;
    lastOkKey.current = state.key;

    if (!continueSubmit.current) {
      onSuccess?.();
      return;
    }

    setAmount("");
    setMemo("");
    setCategoryId("");
    setReflectIds([]);
    setIsShared(false);
    setAmountPreview(null);
    setSavedCount((n) => n + 1);
    amountRef.current?.focus();
    // onSuccess が毎レンダー変わっても、lastOkKey で二重発火は防がれる。
  }, [state, onSuccess]);

  const toggleReflect = (id: string) => {
    setReflectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

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

  // 金額欄の変更を state とプレビューに反映する（OCR からの自動入力にも使う）。
  const changeAmount = (value: string) => {
    setAmount(value);
    updateAmountPreview(value);
  };

  // レシートOCRの抽出結果をフォームへ反映する（抽出できた項目のみ）。
  const applyScanResult = (result: ParsedReceipt) => {
    if (result.amount !== null) {
      changeAmount(String(result.amount));
    }
    if (result.date !== null) {
      setDate(result.date);
    }
  };

  const options = categories.filter(
    (c) => (!c.is_hidden || c.id === defaultValues?.category_id) && (c.type === type || c.type === "both"),
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
      {dialog ? <input type="hidden" name="_dialog" value="1" /> : null}

      {showReceiptScan ? (
        <div className="space-y-1.5">
          <ReceiptScanButton onResult={applyScanResult} />
          <p className="text-center text-xs text-muted-foreground">
            レシート画像から金額・日付を自動入力します（内容をご確認ください）
          </p>
        </div>
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
            value={amount}
            required
            onChange={(e) => changeAmount(e.target.value)}
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
          type="text"
          placeholder="YYYY-MM-DD"
          aria-describedby="transaction-date-format"
          value={date}
          ref={dateRef}
          onChange={(event) => setDate(event.currentTarget.value)}
          required
        />
        <p id="transaction-date-format" className="text-xs text-muted-foreground">
          YYYY-MM-DD（例 2024-02-29）
        </p>
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
          id="memo"
          name="memo"
          rows={2}
          maxLength={200}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {members && members.length > 1 && currentUserId ? (
        <div className="space-y-2">
          <Label htmlFor="on_behalf_of">名義人</Label>
          <select
            id="on_behalf_of"
            name="on_behalf_of"
            value={onBehalfOf}
            onChange={(e) => setOnBehalfOf(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user_id === currentUserId
                  ? `${m.display_name}（自分）`
                  : m.display_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            この収支を誰の記録として集計するかを選べます。自分以外を選ぶと代理入力になります。
          </p>
        </div>
      ) : null}

      {type === "expense" && (defaultValues?.amount ?? 0) >= 0 ? (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              精算対象（割り勘）
            </span>
            <span className="block text-xs text-muted-foreground">
              メンバー間精算の均等割りに含めます
            </span>
          </span>
          <input
            type="checkbox"
            name="is_shared"
            value="true"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="size-5 accent-primary"
          />
        </label>
      ) : null}

      {otherHouseholds && otherHouseholds.length > 0 ? (
        <details className="rounded-xl border border-border bg-muted/40 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium select-none">
            他のグループにも反映する
            {reflectIds.length > 0 ? `（${reflectIds.length}件選択中）` : ""}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            選択したグループにも同じ収支をコピーします。カテゴリは同名のものに紐付け、無ければ未分類になります。
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {otherHouseholds.map((h) => {
              const checked = reflectIds.includes(h.id);
              return (
                <label
                  key={h.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleReflect(h.id)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  {h.name}
                </label>
              );
            })}
          </div>
        </details>
      ) : null}
      {reflectIds.map((id) => (
        <input key={id} type="hidden" name="reflect_household_ids" value={id} />
      ))}

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
          onClick={() => {
            continueSubmit.current = false;
          }}
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
            onClick={() => {
              continueSubmit.current = true;
            }}
          >
            登録して続ける
          </Button>
        ) : null}
      </div>
    </form>
  );
}
