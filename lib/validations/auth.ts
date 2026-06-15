import { z } from "zod";

/** 入力欄の補足表示に使うパスワードポリシーの要件文言（バリデーションと同期させる） */
export const PASSWORD_POLICY_HINT =
  "8文字以上で、英大文字・英小文字・数字・記号をそれぞれ含めてください";

const PASSWORD_POLICY_MESSAGE = `パスワードは${PASSWORD_POLICY_HINT}`;

/** 登録・再設定・変更時に適用するパスワードポリシー（ログイン認証には適用しない） */
const passwordPolicy = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[0-9]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[^A-Za-z0-9]/, PASSWORD_POLICY_MESSAGE);

export const loginSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
  password: z.string().min(6, "パスワードは6文字以上で入力してください"),
});

export const registerSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
  password: passwordPolicy,
});

export const resetRequestSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
});

export const passwordUpdateSchema = z
  .object({
    password: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>;
