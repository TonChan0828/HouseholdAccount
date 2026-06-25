import { z } from "zod";

import { evaluateAmount } from "@/lib/amount-expression";

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"], {
    message: "収入か支出を選択してください",
  }),
  // 金額欄は四則演算式を受け付ける。文字列は evaluateAmount で評価・四捨五入し、
  // 評価不能なら NaN にして z.number() で弾く。
  amount: z.preprocess(
    (v) => (typeof v === "string" ? evaluateAmount(v) : v),
    z
      .number({ message: "金額を正しく入力してください" })
      .int("金額は整数で入力してください")
      .min(1, "金額は1円以上で入力してください"),
  ),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください"),
  // カテゴリ未選択は空文字で送られてくるため undefined に正規化する。
  category_id: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().uuid("カテゴリが不正です").optional(),
  ),
  memo: z
    .string()
    .max(200, "メモは200文字以内で入力してください")
    .optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
