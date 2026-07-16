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
