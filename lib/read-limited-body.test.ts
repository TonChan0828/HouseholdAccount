import { expect, it, vi } from "vitest";
import { BodyReadError, readLimitedBody } from "./read-limited-body";

function request(stream: ReadableStream<Uint8Array>): Request {
  return new Request("https://example.com", { method: "POST", body: stream, duplex: "half" } as RequestInit);
}
it("上限ちょうどのUTF-8本文を受け付ける", async () => {
  expect(await readLimitedBody(new Request("https://example.com", { method: "POST", body: "あ" }), 3, 1000)).toBe("あ");
});
it("申告サイズなしでも上限超過時に読み込みを中止する", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(new Uint8Array(32 * 1024)); c.enqueue(new Uint8Array(1)); }, cancel,
  });
  await expect(readLimitedBody(request(stream), 32 * 1024, 1000)).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalledOnce();
});
it("送信が停止しても期限で中止する", async () => {
  const cancel = vi.fn();
  await expect(readLimitedBody(request(new ReadableStream({ cancel })), 100, 10))
    .rejects.toMatchObject({ status: 408 });
  expect(cancel).toHaveBeenCalledOnce();
});
it("途中で切断された本文を拒否する", async () => {
  await expect(readLimitedBody(request(new ReadableStream({ start(c) { c.error(new Error("secret")); } })), 100, 1000))
    .rejects.toBeInstanceOf(BodyReadError);
});
