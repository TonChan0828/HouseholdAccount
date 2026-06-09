import { z } from "zod";

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"], {
    message: "収入か支出を選択してください",
  }),
  amount: z.coerce
    .number()
    .int("金額は整数で入力してください")
    .min(1, "金額は1円以上で入力してください"),
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
