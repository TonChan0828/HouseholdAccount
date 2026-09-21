type LogValue = string | number | boolean | null | undefined;

type ErrorMetadata = {
  name: string;
  digest?: string;
  code?: string;
};

function errorMetadata(error: unknown): ErrorMetadata {
  if (typeof error !== "object" || error === null) {
    return { name: typeof error };
  }

  const value = error as Record<string, unknown>;
  return {
    name:
      error instanceof Error
        ? error.name
        : typeof value.name === "string"
          ? value.name
          : "UnknownError",
    digest: typeof value.digest === "string" ? value.digest : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
  };
}

/**
 * サーバー障害をログ集約基盤で検索しやすい JSON として出力する。
 *
 * エラーメッセージや任意オブジェクトは、DB 値・トークン等を含み得るため記録しない。
 * 呼び出し側も ID・メールアドレス・URL クエリを attributes に渡さないこと。
 */
export function logServerError(
  event: string,
  error: unknown,
  attributes: Record<string, LogValue> = {},
): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event,
      ...attributes,
      error: errorMetadata(error),
    }),
  );
}
