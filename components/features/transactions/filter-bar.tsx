"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildFilterQueryString,
  hasActiveFilter,
  parseTransactionFilter,
  type TransactionFilter,
  type TransactionFilterParams,
} from "@/lib/transaction-filter";
import { cn } from "@/lib/utils";

type CategoryOption = { id: string; name: string; color: string | null; is_hidden?: boolean };
type MemberOption = { user_id: string; display_name: string };

type Props = {
  /** サーバー側で検証済みの現在のフィルタ。 */
  filter: TransactionFilter;
  /** 表示中の期間（ref クエリ）。指定時は URL に引き継いで期間を維持する。 */
  currentRef?: string;
  categories: CategoryOption[];
  members: MemberOption[];
  className?: string;
  basePath?: "/transactions" | "/calendar";
};

const TYPE_ITEMS: { value: string; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "income", label: "収入" },
  { value: "expense", label: "支出" },
];

const DEBOUNCE_MS = 300;

const selectClass =
  "h-9 min-w-0 rounded-lg border border-border bg-background px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * 収支一覧の検索・絞り込みバー（spec 36）。フィルタ状態は URL クエリに持ち、
 * 変更のたびに router.replace で Server Component を再描画させる。
 * テキスト入力（メモ・金額）は 300ms デバウンスして反映する。
 */
export function FilterBar({
  filter,
  currentRef,
  categories,
  members,
  className,
  basePath = "/transactions",
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(filter.memoQuery ?? "");
  const [min, setMin] = useState(filter.minAmount?.toString() ?? "");
  const [max, setMax] = useState(filter.maxAmount?.toString() ?? "");
  // モバイルではメモ・名義人・金額を「絞り込み」ボタンで開閉する
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /** 現在の UI 状態を生クエリパラメータとして集める（over で一部上書き）。 */
  const rawParams = (
    over: Partial<TransactionFilterParams> = {},
  ): TransactionFilterParams => ({
    type: filter.type,
    category: filter.categoryId,
    member: filter.createdBy,
    q,
    min,
    max,
    ...over,
  });

  const navigate = (params: TransactionFilterParams) => {
    const qs = buildFilterQueryString(parseTransactionFilter(params));
    const parts = [
      currentRef ? `ref=${currentRef}` : "",
      qs,
    ]
      .filter(Boolean)
      .join("&");
    router.replace(parts ? `${basePath}?${parts}` : basePath, {
      scroll: false,
    });
  };

  const applyNow = (over: Partial<TransactionFilterParams>) => {
    if (timer.current) clearTimeout(timer.current);
    navigate(rawParams(over));
  };

  const applyDebounced = (over: Partial<TransactionFilterParams>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(rawParams(over)), DEBOUNCE_MS);
  };

  const clearAll = () => {
    if (timer.current) clearTimeout(timer.current);
    setQ("");
    setMin("");
    setMax("");
    navigate({});
  };

  const active = hasActiveFilter(filter);

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border bg-card/70 p-3 shadow-soft ring-1 ring-foreground/5 backdrop-blur",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
          {TYPE_ITEMS.map((item) => {
            const isActive = (filter.type ?? "") === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => applyNow({ type: item.value })}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
              クリア
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground sm:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            絞り込み
          </Button>
        </div>
      </div>

      <select
        aria-label="カテゴリ"
        value={filter.categoryId ?? ""}
        onChange={(e) => applyNow({ category: e.target.value })}
        className={cn(selectClass, "w-full sm:w-auto")}
        >
        <option value="">すべてのカテゴリ</option>
        {categories.filter((c) => !c.is_hidden || c.id === filter.categoryId).map((c) => (
          <option key={c.id} value={c.id} disabled={c.is_hidden}>
            {c.name}
          </option>
        ))}
      </select>

      {active ? (
        <p className="break-words text-sm text-muted-foreground" role="status">
          適用中の条件：{[
            filter.type && (filter.type === "income" ? "収入" : "支出"),
            filter.categoryId && `カテゴリ ${categories.find((item) => item.id === filter.categoryId)?.name ?? "指定のカテゴリ"}`,
            filter.createdBy && `名義人 ${members.find((item) => item.user_id === filter.createdBy)?.display_name ?? "指定の名義人"}`,
            filter.memoQuery && `メモ「${filter.memoQuery}」`,
            filter.minAmount !== undefined && `${filter.minAmount.toLocaleString()}円以上`,
            filter.maxAmount !== undefined && `${filter.maxAmount.toLocaleString()}円以下`,
          ].filter(Boolean).join("、")}
        </p>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3",
          !open && "max-sm:hidden",
        )}
      >
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="メモを検索"
            placeholder="メモを検索"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              applyDebounced({ q: e.target.value });
            }}
            className="h-9 pl-9"
          />
        </div>

        {members.length > 1 ? (
          <select
            aria-label="メンバー（名義人）"
            value={filter.createdBy ?? ""}
            onChange={(e) => applyNow({ member: e.target.value })}
            className={selectClass}
          >
            <option value="">すべてのメンバー</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        ) : null}

        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            aria-label="金額(下限)"
            placeholder="金額(下限)"
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              applyDebounced({ min: e.target.value });
            }}
            className="h-9"
          />
          <span aria-hidden className="text-muted-foreground">
            〜
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            aria-label="金額(上限)"
            placeholder="金額(上限)"
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              applyDebounced({ max: e.target.value });
            }}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}
