"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CategorySlice } from "@/lib/analytics";

type Props = {
  data: CategorySlice[];
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** 当期の支出をカテゴリ別に表示する円グラフ＋凡例（presentational）。 */
export function CategoryPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        当期の支出はまだありません。
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              innerRadius={40}
              outerRadius={80}
            >
              {data.map((slice) => (
                <Cell
                  key={slice.categoryId ?? "none"}
                  fill={slice.color}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value: unknown) => yen(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1 text-sm">
        {data.map((slice) => (
          <li
            key={slice.categoryId ?? "none"}
            className="flex items-center justify-between gap-2"
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {slice.name}
            </span>
            <span className="tabular-nums">{yen(slice.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
