import { z } from "zod";

import { evaluateAmount } from "@/lib/amount-expression";

export const budgetSchema = z.object({
  category_id: z.string().uuid("カテゴリが不正です"),
  // 予算額は四則演算式を受け付ける（収支の金額欄と同方針）。評価不能なら NaN で弾く。
  amount: z.preprocess(
    (v) => (typeof v === "string" ? evaluateAmount(v) : v),
    z
      .number({ message: "予算額を正しく入力してください" })
      .int("予算額は整数で入力してください")
      .min(1, "予算額は1円以上で入力してください"),
  ),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
