import { DataAccessError } from "@/lib/queries/errors";

/** Supabase の取得結果を検査し、障害と「データなし」を区別する。 */
export function unwrapData<T>(
  result: { data: T; error: unknown },
  operation: string,
): T {
  if (result.error) {
    throw new DataAccessError(operation, result.error);
  }
  return result.data;
}

/** Supabase の変更系結果を検査し、失敗後の再検証・遷移を防ぐ。 */
export function throwIfError(
  result: { error: unknown },
  operation: string,
): void {
  if (result.error) {
    throw new DataAccessError(operation, result.error);
  }
}
