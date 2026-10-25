export class BodyReadError extends Error {
  constructor(public readonly status: 400 | 408 | 413) {
    super("Request body rejected");
  }
}

/** 本文の申告サイズを信用せず、実際のバイト数と時間を制限する。 */
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new BodyReadError(408));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new BodyReadError(413);
      chunks.push(value);
    }
    const buffer = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    // cancel() 自体が停止しない送信元でも応答を待たせない。
    void reader.cancel().catch(() => {});
    throw error instanceof BodyReadError ? error : new BodyReadError(400);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
