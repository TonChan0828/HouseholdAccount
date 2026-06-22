import { z } from "zod";

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(20, "表示名は20文字以内で入力してください"),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * グループ毎の表示名（ニックネーム）。
 * 任意のため空文字を許可し（= ニックネーム解除してグローバル名にフォールバック）、
 * 空白のみは空文字に正規化する。長さ上限のみ profileSchema と揃える。
 */
export const groupDisplayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(20, "表示名は20文字以内で入力してください"),
});

export type GroupDisplayNameInput = z.infer<typeof groupDisplayNameSchema>;
