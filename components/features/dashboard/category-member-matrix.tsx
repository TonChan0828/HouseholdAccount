"use client";

import { useEffect, useRef, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type {
  CategoryMemberMatrix as Matrix,
  MatrixSection,
} from "@/lib/category-matrix";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  matrix: Matrix;
};

function amountCell(value: number) {
  if (value === 0) {
    return <span className="text-muted-foreground/50">-</span>;
  }
  return yen(value);
}

function MatrixTable({
  label,
  tone,
  section,
  members,
  testId,
}: {
  label: string;
  tone: string;
  section: MatrixSection;
  members: Matrix["members"];
  testId: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // overflowing: そもそも横スクロール可能か（列が画面に収まらないか）。
  // canScrollRight: さらに右へスクロールできる余地があるか（末尾では false）。
  // ヒント行は overflowing の間つねに高さを確保し、テキストの表示/非表示は
  // 不透明度だけで切り替える（スクロール中に行が出入りして表がガタつくのを防ぐ）。
  const [overflowing, setOverflowing] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const slack = el.scrollWidth - el.clientWidth;
      setOverflowing(slack > 1);
      setCanScrollRight(slack - el.scrollLeft > 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return (
    <Card className="shadow-soft ring-0" data-testid={testId}>
      <CardContent className="space-y-2 py-4 max-sm:px-3">
        <p className={cn("text-xs font-semibold", tone)}>{label}</p>
        {overflowing ? (
          <p
            aria-hidden={!canScrollRight}
            className={cn(
              "text-xs text-muted-foreground transition-opacity sm:hidden",
              canScrollRight ? "opacity-100" : "opacity-0",
            )}
          >
            横にスクロールできます →
          </p>
        ) : null}
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-card py-1.5 pr-2 text-left font-medium">
                    カテゴリ
                  </th>
                  {members.map((m) => (
                    <th
                      key={m.userId}
                      className="py-1.5 pl-2 text-right font-medium"
                    >
                      <span className="ml-auto block max-w-[6rem] truncate sm:max-w-[10rem]">
                        {m.displayName}
                      </span>
                    </th>
                  ))}
                  <th className="py-1.5 pl-2 text-right font-medium">合計</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr
                    key={row.categoryId ?? "__none__"}
                    className="border-b border-border/40"
                  >
                    <td className="sticky left-0 z-10 bg-card py-1.5 pr-2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          aria-hidden
                          className="inline-block size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        {row.name}
                      </span>
                    </td>
                    {row.cells.map((value, i) => (
                      <td
                        key={members[i].userId}
                        className="py-1.5 pl-2 text-right tabular-nums"
                      >
                        {amountCell(value)}
                      </td>
                    ))}
                    <td className="py-1.5 pl-2 text-right font-medium tabular-nums">
                      {amountCell(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={cn("font-bold", tone)}>
                  <td className="sticky left-0 z-10 bg-card py-1.5 pr-2">
                    合計
                  </td>
                  {section.memberTotals.map((value, i) => (
                    <td
                      key={members[i].userId}
                      className="py-1.5 pl-2 text-right tabular-nums"
                    >
                      {amountCell(value)}
                    </td>
                  ))}
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {amountCell(section.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {overflowing ? (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card transition-opacity",
                canScrollRight ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** 行=カテゴリ / 列=メンバーの収支マトリクスを支出・収入別に表示する（presentational）。 */
export function CategoryMemberMatrix({ matrix }: Props) {
  const hasExpense = matrix.expense.rows.length > 0;
  const hasIncome = matrix.income.rows.length > 0;
  if (!hasExpense && !hasIncome) return null;

  return (
    <section className="space-y-2" data-testid="category-member-matrix">
      <h2 className="font-heading text-base font-bold">メンバー別カテゴリ</h2>
      <div className="space-y-3">
        {hasExpense ? (
          <MatrixTable
            label="支出"
            tone="text-expense"
            section={matrix.expense}
            members={matrix.members}
            testId="matrix-expense"
          />
        ) : null}
        {hasIncome ? (
          <MatrixTable
            label="収入"
            tone="text-income"
            section={matrix.income}
            members={matrix.members}
            testId="matrix-income"
          />
        ) : null}
      </div>
    </section>
  );
}
