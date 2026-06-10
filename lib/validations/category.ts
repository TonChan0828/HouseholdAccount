import { z } from "zod";

/** カテゴリ色のプリセット（デフォルトカテゴリと同系の12色）。 */
export const CATEGORY_COLORS = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
] as const;

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "カテゴリ名を入力してください")
    .max(50, "カテゴリ名は50文字以内で入力してください"),
  color: z.enum(CATEGORY_COLORS, { message: "色を選択してください" }),
  type: z.enum(["income", "expense", "both"], {
    message: "種別を選択してください",
  }),
});

export type CategoryInput = z.infer<typeof categorySchema>;
