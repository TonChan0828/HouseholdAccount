/**
 * 収支の「帰属ユーザー」を解決する純関数群（spec 41）。
 *
 * - `created_by` … 実際に入力操作をした人（DB トリガーで不変）
 * - `on_behalf_of` … 名義人。NULL なら入力者本人が名義人
 *
 * 集計上の帰属ユーザーは `coalesce(on_behalf_of, created_by)` と定義し、
 * その判断をこのモジュールに一本化する（メンバー別集計・精算・フィルタ・CSV が共有する）。
 * DB クライアントも React も import せず、ユニットテストから素で叩ける形にしておく。
 */

/** 帰属判定に必要な最小形（DB の select 結果と構造互換）。 */
export type Attributable = {
  created_by: string;
  /** 列を持たない行（デモモード等）も渡せるよう optional にする。 */
  on_behalf_of?: string | null;
};

/** 集計上の帰属ユーザー = coalesce(on_behalf_of, created_by)。 */
export function attributedTo(tx: Attributable): string {
  return tx.on_behalf_of ?? tx.created_by;
}

/** 代理入力か（名義人が入力者と異なる）。補助表示の出し分けに使う。 */
export function isProxyEntry(tx: Attributable): boolean {
  return tx.on_behalf_of != null && tx.on_behalf_of !== tx.created_by;
}

/**
 * 編集・削除できるか（入力者本人 または 名義人）。
 * 0024 の RLS ポリシー（update/delete の USING 句）と 1 対 1 に対応させる。
 */
export function canEditTransaction(tx: Attributable, userId: string): boolean {
  return tx.created_by === userId || tx.on_behalf_of === userId;
}

/** 「花子（太郎が代理）」の補助ラベル。代理入力でなければ null。 */
export function proxyLabel(
  tx: Attributable,
  nameById: ReadonlyMap<string, string>,
): string | null {
  if (!isProxyEntry(tx)) {
    return null;
  }
  const subject = nameById.get(attributedTo(tx)) ?? "不明なユーザー";
  const author = nameById.get(tx.created_by) ?? "不明なユーザー";
  return `${subject}（${author}が代理）`;
}

/**
 * フォームから来た名義人を正規化する。
 *
 * 比較対象は「その収支の入力者（created_by）」であり、操作しているユーザーではない。
 * 名義人＝入力者なら代理ではないので NULL に倒し、代理入力だけを列に残す。
 * 新規登録では入力者＝自分なので authorId に自分の id を渡せばよいが、
 * 編集では他人が入力した収支を名義人が直すことがあるため、必ず対象行の
 * created_by を渡すこと（自分と比べると名義が不本意に外れる）。
 */
export function normalizeOnBehalfOf(
  value: string | undefined,
  authorId: string,
): string | null {
  if (!value || value === authorId) {
    return null;
  }
  return value;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 「帰属ユーザー = userId」を PostgREST の or 句で表現する。
 *
 * SQL の `coalesce(on_behalf_of, created_by) = userId` に相当し、
 * トップレベルの or は他の条件と AND で結合されるため既存フィルタと共存する。
 * 値は文字列としてクエリに埋まるため、呼び出し側の検証に依存せず
 * ここで UUID を再検証する（`,` や `)` による式の書き換えを防ぐ二重防御）。
 */
export function attributionOrFilter(userId: string): string {
  if (!UUID_RE.test(userId)) {
    throw new Error("attributionOrFilter: userId must be a UUID");
  }
  return `on_behalf_of.eq.${userId},and(on_behalf_of.is.null,created_by.eq.${userId})`;
}
