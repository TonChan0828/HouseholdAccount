/** 収支トーン。income=収入 / expense=支出 / neutral=中立。 */
export type Tone = "income" | "expense" | "neutral";

/** 丸チップなどの「背景＋文字色」セット。 */
export const TONE_CHIP: Record<Tone, string> = {
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  neutral: "bg-secondary text-secondary-foreground",
};

/** 数値・テキストの文字色のみ。 */
export const TONE_TEXT: Record<Tone, string> = {
  income: "text-income",
  expense: "text-expense",
  neutral: "text-foreground",
};
