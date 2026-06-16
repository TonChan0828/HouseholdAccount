import { z } from "zod";

// 確認フレーズ（登録メールアドレス）の最小バリデーション。
// メールアドレスとの一致判定は user.email に依存するため Server Action 内で行う。
export const accountDeletionSchema = z.object({
  confirmText: z.string().trim().min(1, "確認のためメールアドレスを入力してください"),
});

export type AccountDeletionInput = z.infer<typeof accountDeletionSchema>;
