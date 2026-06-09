import { z } from "zod";

export const createHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "グループ名を入力してください")
    .max(100, "グループ名は100文字以内で入力してください"),
});

/** 招待リンクの人数上限（owner が指定）。発行時・上限変更時の双方で使う。 */
export const invitationLimitSchema = z.object({
  maxUses: z.coerce
    .number()
    .int("人数は整数で指定してください")
    .min(1, "人数は1人以上で指定してください")
    .max(50, "人数は50人以内で指定してください"),
});

/** 月の区切りの開始日（締め日モデル）。短い月で消失しないよう 1〜28。 */
export const periodStartDaySchema = z.object({
  periodStartDay: z.coerce
    .number()
    .int("開始日は整数で指定してください")
    .min(1, "開始日は1〜28で指定してください")
    .max(28, "開始日は1〜28で指定してください"),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type InvitationLimitInput = z.infer<typeof invitationLimitSchema>;
export type PeriodStartDayInput = z.infer<typeof periodStartDaySchema>;
