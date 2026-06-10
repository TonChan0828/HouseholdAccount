"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { MemberSummary, MemberTx } from "@/lib/members";
import { cn } from "@/lib/utils";

export type MemberTxRow = MemberTx & { id: string };

type Props = {
  summaries: MemberSummary[];
  txs: MemberTxRow[];
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  "transition-colors hover:bg-accent/50",
                  active && "border-primary bg-accent/50",
                )}
              >
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {m.displayName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {m.count}件
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-income tabular-nums">
                      {yen(m.income)}
                    </span>
                    <span className="text-expense tabular-nums">
                      {yen(m.expense)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {selected ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">{selected.displayName} の取引</h2>
          {selectedTxs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                この期間の取引はありません。
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {selectedTxs.map((t) => (
                <li key={t.id}>
                  <Card data-testid="member-transaction-row">
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground tabular-nums">
                            {t.date}
                          </span>
                          {t.category ? (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="inline-block size-2 rounded-full"
                                style={{
                                  backgroundColor: t.category.color ?? "#999",
                                }}
                              />
                              {t.category.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">未分類</span>
                          )}
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
                            ? "shrink-0 font-semibold text-income tabular-nums"
                            : "shrink-0 font-semibold text-expense tabular-nums"
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
