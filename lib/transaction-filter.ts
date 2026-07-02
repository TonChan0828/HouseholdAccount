/**
 * 収支一覧の検索・絞り込み（spec 36）。
 * URL クエリパラメータとフィルタ条件の相互変換を担う純関数群。
 * 不正な値はエラーにせず無視する（常に安全側＝全件表示に倒す）。
 */

export type TransactionFilter = {
  type?: "income" | "expense";
  categoryId?: string;
  createdBy?: string;
  memoQuery?: string;
  minAmount?: number;
  maxAmount?: number;
};

/** URL クエリパラメータ（未検証の生値）。 */
export type TransactionFilterParams = {
  type?: string;
  category?: string;
  member?: string;
  q?: string;
  min?: string;
  max?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseAmount(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

/** クエリパラメータを検証し、有効な条件だけのフィルタに正規化する。 */
export function parseTransactionFilter(
  params: TransactionFilterParams,
): TransactionFilter {
  const filter: TransactionFilter = {};

  if (params.type === "income" || params.type === "expense") {
    filter.type = params.type;
  }
  if (params.category && UUID_RE.test(params.category)) {
    filter.categoryId = params.category;
  }
  if (params.member && UUID_RE.test(params.member)) {
    filter.createdBy = params.member;
  }
  const q = params.q?.trim();
  if (q) filter.memoQuery = q;

  const min = parseAmount(params.min);
  if (min !== undefined) filter.minAmount = min;
  const max = parseAmount(params.max);
  if (max !== undefined) filter.maxAmount = max;

  return filter;
}

/** PostgreSQL LIKE / ILIKE 用に `\` `%` `_` をエスケープする。 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** 1つでも有効な条件を持つか。クリアボタン・空状態の出し分けに使う。 */
export function hasActiveFilter(filter: TransactionFilter): boolean {
  return Object.values(filter).some((v) => v !== undefined);
}

/**
 * フィルタを URL クエリ文字列（`type=expense&q=...` 形式・先頭 & なし）へ
 * 変換する。期間ナビの前月/翌月リンクへの引き継ぎに使う。
 */
export function buildFilterQueryString(filter: TransactionFilter): string {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.categoryId) params.set("category", filter.categoryId);
  if (filter.createdBy) params.set("member", filter.createdBy);
  if (filter.memoQuery) params.set("q", filter.memoQuery);
  if (filter.minAmount !== undefined) params.set("min", String(filter.minAmount));
  if (filter.maxAmount !== undefined) params.set("max", String(filter.maxAmount));
  return params.toString();
}
