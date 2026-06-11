"use client";

import { useState } from "react";

import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { Card, CardContent } from "@/components/ui/card";
import { yen } from "@/lib/format";
import type { MemberSummary, MemberTx } from "@/lib/members";
import { cn } from "@/lib/utils";

export type MemberTxRow = MemberTx & { id: string };

type Props = {
  summaries: MemberSummary[];
  txs: MemberTxRow[];
};

/** メンバーごとのアクセントカラー（テーマのチャートパレットを順番に割り当てる）。 */
const MEMBER_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-3)",
] as const;

/**
 * メンバーごとのサマリーカードと、選択中メンバーの取引一覧。
 * カードのクリックで展開・再クリックで閉じる（クライアント状態）。
 */
export function MemberActivity({ summaries, txs }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = summaries.find((m) => m.userId === selectedId);
  const selectedTxs = selected
    ? txs.filter((t) => t.created_by === selected.userId)
    : [];

  const colorOf = (userId: string) =>
    MEMBER_COLORS[
      Math.max(
        summaries.findIndex((m) => m.userId === userId),
        0,
      ) % MEMBER_COLORS.length
    ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summaries.map((m) => {
          const active = m.userId === selectedId;
          return (
            <button
              key={m.userId}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(active ? null : m.userId)}
              className="text-left"
              data-testid="member-card"
            >
              <Card
                className={cn(
                  "shadow-soft ring-0 transition-all hover:shadow-lifted",
                  active && "bg-secondary/40 outline-2 outline-primary",
                )}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full font-heading text-base font-bold text-white"
                    style={{ backgroundColor: colorOf(m.userId) }}
                  >
                    {m.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {m.displayName}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                        {m.count}件
                      </span>
                    </span>
                    <span className="flex gap-4 text-sm">
                      <span className="font-medium text-income tabular-nums">
                        {yen(m.income)}
                      </span>
                      <span className="font-medium text-expense tabular-nums">
                        {yen(m.expense)}
                      </span>
                    </span>
                  </span>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {selected ? (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-bold">
            {selected.displayName} の取引
          </h2>
          {selectedTxs.length === 0 ? (
            <Card className="shadow-soft ring-0">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                この期間の取引はありません。
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {selectedTxs.map((t) => (
                <li key={t.id}>
                  <Card
                    data-testid="member-transaction-row"
                    className="shadow-soft ring-0"
                  >
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t.date}
                          </span>
                          <CategoryBadge category={t.category} />
                        </div>
                        {t.memo ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {t.memo}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={
                          t.type === "income"
                            ? "shrink-0 font-heading font-bold text-income tabular-nums"
                            : "shrink-0 font-heading font-bold text-expense tabular-nums"
                        }
                      >
                        {t.type === "income" ? "+" : "-"}
                        {yen(t.amount)}
                      </span>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
