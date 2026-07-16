/** 予期しないデータ取得障害。画面では error.tsx に委ね、詳細はクライアントへ出さない。 */
export class DataAccessError extends Error {
  constructor(
    public readonly operation: string,
    cause?: unknown,
  ) {
    super(`Data access failed: ${operation}`, { cause });
    this.name = "DataAccessError";
  }
}
