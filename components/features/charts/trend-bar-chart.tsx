"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PeriodSummary } from "@/lib/analytics";

type Props = {
  data: PeriodSummary[];
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const compact = (n: number) =>
  n >= 10000 ? `${Math.round(n / 1000) / 10}万` : `${n}`;

/** 直近の各期の収入・支出を並べた棒グラフ（presentational）。 */
export function TrendBarChart({ data }: Props) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={44} />
          <Tooltip formatter={(value: unknown) => yen(Number(value))} />
          <Bar dataKey="income" name="収入" fill="#059669" radius={[2, 2, 0, 0]} />
          <Bar dataKey="expense" name="支出" fill="#dc2626" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
