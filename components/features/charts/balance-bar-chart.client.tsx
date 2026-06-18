"use client";

import dynamic from "next/dynamic";

import { ChartSkeleton } from "./chart-skeleton";

/**
 * Recharts を初期描画後に遅延ロードするラッパー。
 * 重い Recharts を共通バンドルから切り離し、ロード中はスケルトンを表示する。
 */
export const BalanceBarChart = dynamic(
  () => import("./balance-bar-chart").then((m) => m.BalanceBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
