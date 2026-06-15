"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildBalanceBars } from "@/lib/analytics";

type Props = {
  income: number;
  expense: number;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const compact = (n: number) =>
  n >= 10000 ? `${Math.round(n / 1000) / 10}万` : `${n}`;

const fillFor = (key: "income" | "expense") =>
  key === "income" ? "var(--income)" : "var(--expense)";

/** 当期の収入・支出を2本の棒で並べた棒グラフ（presentational）。 */
export function BalanceBarChart({ income, expense }: Props) {
  const data = buildBalanceBars(income, expense);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 0, height: 224 }}
      >
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={44} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value: unknown) => yen(Number(value))}
          />
          <Bar dataKey="amount" name="金額" radius={[2, 2, 0, 0]}>
            {data.map((bar) => (
              <Cell key={bar.key} fill={fillFor(bar.key)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
