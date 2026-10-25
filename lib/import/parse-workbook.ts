import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { isAbsolute } from "node:path";

import type { BudgetRow } from "@/lib/import/excel";
import { WORKBOOK_WORKER_SOURCE } from "./workbook-worker-source";

// スレッド内のrequire()には、バンドラーの識別子ではなく実ファイルのパスが必要。
// 静的なrequire.resolve()は依存ファイルの追跡用に残す。
// Turbopackの内部識別子はNode.jsの実行時の解決結果へ置き換える。
const runtimeRequire = createRequire(import.meta.url);

export function resolveWorkbookModule(name: string, bundledPath: string): string {
  if (isAbsolute(bundledPath)) return bundledPath;
  // createRequire().resolve("literal")もTurbopackが書き換えるため、
  // 関数として呼び出し、Node.jsのモジュール解決を実行時まで保持する。
  return Reflect.apply(runtimeRequire.resolve, runtimeRequire, [name]);
}

export type SheetParse = { sheet: string; rows: BudgetRow[] };

export const WORKBOOK_LIMITS = {
  compressedBytes: 5 * 1024 * 1024,
  expandedBytes: 16 * 1024 * 1024,
  entryBytes: 8 * 1024 * 1024,
  entries: 128, sheets: 24, rows: 10_000, cells: 50_000,
  cellCharacters: 32_767, columns: 256, importRows: 500,
} as const;

/** 展開・XML検査・ExcelJS解析を隔離し、時間とメモリの両方を制限する。 */
export async function parseWorkbook(buffer: ArrayBuffer, timeoutMs = 10_000): Promise<SheetParse[]> {
  if (buffer.byteLength > WORKBOOK_LIMITS.compressedBytes) throw new Error("WorkbookTooLarge");
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKBOOK_WORKER_SOURCE, {
      eval: true,
      workerData: {
        buffer, limits: WORKBOOK_LIMITS,
        modules: {
          exceljs: resolveWorkbookModule("exceljs", require.resolve("exceljs")),
          yauzl: resolveWorkbookModule("yauzl", require.resolve("yauzl")),
          saxes: resolveWorkbookModule("saxes", require.resolve("saxes")),
          jszip: resolveWorkbookModule("jszip", require.resolve("jszip")),
        },
      },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
    });
    let settled = false;
    const finish = (error?: Error, data?: SheetParse[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(data!);
    };
    const timer = setTimeout(() => finish(new Error("WorkbookTimeout")), timeoutMs);
    worker.once("message", (message: { ok: boolean; sheets?: SheetParse[] }) => {
      if (!message.ok || !Array.isArray(message.sheets)) finish(new Error("InvalidWorkbook"));
      else finish(undefined, message.sheets);
    });
    worker.once("error", () => finish(new Error("WorkbookWorkerFailed")));
    worker.once("exit", () => finish(new Error("WorkbookWorkerStopped")));
  });
}
