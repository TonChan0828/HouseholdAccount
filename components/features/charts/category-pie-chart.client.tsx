"use client";

import dynamic from "next/dynamic";

import { ChartSkeleton } from "./chart-skeleton";

/**
 * Recharts を初期描画後に遅延ロードするラッパー。
 * 重い Recharts を共通バンドルから切り離し、ロード中はスケルトンを表示する。
 */
export const CategoryPieChart = dynamic(
  () => import("./category-pie-chart").then((m) => m.CategoryPieChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-48" /> },
);
