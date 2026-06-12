import { z } from "zod";

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(20, "表示名は20文字以内で入力してください"),
});

export type ProfileInput = z.infer<typeof profileSchema>;
