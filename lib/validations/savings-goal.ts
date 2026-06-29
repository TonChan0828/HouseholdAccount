import { z } from "zod";

import { evaluateAmount } from "@/lib/amount-expression";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です");

export const savingsGoalSchema = z
  .object({
    name: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(1, "目標名を入力してください")),
    // 目標額は四則演算式を受け付ける（収支・予算の金額欄と同方針）。
    target_amount: z.preprocess(
      (v) => (typeof v === "string" ? evaluateAmount(v) : v),
      z
        .number({ message: "目標額を正しく入力してください" })
        .int("目標額は整数で入力してください")
        .min(1, "目標額は1円以上で入力してください"),
    ),
    start_date: isoDate,
    // 空文字・未入力は null（期日なし）。
    target_date: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      isoDate.nullable(),
    ),
  })
  .refine(
    (d) => d.target_date === null || d.target_date > d.start_date,
    { path: ["target_date"], message: "期日は開始日より後にしてください" },
  );

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;
