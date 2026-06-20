"use client";

import { useActionState, useState } from "react";
import { FileSpreadsheet, TrendingDown, TrendingUp } from "lucide-react";

import type {
  ImportConfirmState,
  ImportPreviewState,
  SheetPreview,
} from "@/app/(dashboard)/transactions/import/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { yen } from "@/lib/format";
import { type ClassifyResult, parseMonthFromFilename } from "@/lib/import/excel";

type ParseAction = (
  state: ImportPreviewState,
  formData: FormData,
) => Promise<ImportPreviewState>;

type ConfirmAction = (
  state: ImportConfirmState,
  formData: FormData,
) => Promise<ImportConfirmState>;

/** プレビュー（取込予定・スキップ・エラー）と確定フォーム。表示専用でテスト対象。 */
export function ImportPreview({
  month,
  result,
  confirmAction,
}: {
  month: string;
  result: ClassifyResult;
  confirmAction: ConfirmAction;
}) {
  const [state, formAction, pending] = useActionState<
    ImportConfirmState,
    FormData
  >(confirmAction, undefined);

  const hasValid = result.valid.length > 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        取込予定 <strong className="text-foreground">{result.valid.length}</strong> 件
        {result.skipped.length > 0 ? `・スキップ ${result.skipped.length} 件` : ""}
        {result.errors.length > 0 ? `・エラー ${result.errors.length} 件` : ""}
      </p>

      {hasValid ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {result.valid.map((r, i) => {
            const Icon = r.type === "income" ? TrendingUp : TrendingDown;
            return (
              <li
                key={`${r.type}-${r.categoryName}-${i}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className={
                      r.type === "income"
                        ? "size-4 text-income"
                        : "size-4 text-expense"
                    }
                    aria-hidden
                  />
                  {r.categoryName}
                </span>
                <span className="font-heading font-bold tabular-nums">
                  {yen(r.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-destructive">取り込める収支がありません。</p>
      )}

      {result.errors.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">エラー（取り込まれません）</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {result.errors.map((e) => (
              <li key={`e-${e.row}`}>
                行{e.row} {e.item}: {e.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.skipped.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">
            スキップした費目 {result.skipped.length} 件
          </summary>
          <ul className="mt-1 space-y-0.5">
            {result.skipped.map((s) => (
              <li key={`s-${s.row}`}>
                行{s.row} {s.item}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <form action={formAction} className="space-y-4 border-t border-border pt-4">
        <input
          type="hidden"
          name="rows"
          value={JSON.stringify(result.valid)}
        />
        <div className="space-y-2">
          <Label htmlFor="month">対象月</Label>
          <Input
            id="month"
            name="month"
            type="month"
            defaultValue={month}
            required
          />
          <p className="text-xs text-muted-foreground">
            取り込む収支はすべてこの月の1日付で登録されます。
          </p>
        </div>

        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-11 w-full text-base shadow-soft"
          disabled={pending || !hasValid}
        >
          {pending ? "取り込み中..." : `${result.valid.length} 件を取り込む`}
        </Button>
      </form>
    </div>
  );
}

/**
 * パース済みシート群を表示する。複数あればシート選択セレクタを出し、選んだシートを
 * プレビュー表示する（再アップロード不要・クライアント状態で切替）。
 */
export function ImportResult({
  sheets,
  confirmAction,
}: {
  sheets: SheetPreview[];
  confirmAction: ConfirmAction;
}) {
  const [selected, setSelected] = useState<string>(sheets[0]?.sheet ?? "");
  const current = sheets.find((s) => s.sheet === selected) ?? sheets[0];

  if (!current) {
    return null;
  }

  return (
    <div className="space-y-5">
      {sheets.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="sheet">シート</Label>
          <select
            id="sheet"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {sheets.map((s) => (
              <option key={s.sheet} value={s.sheet}>
                {s.sheet}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            取り込むシートを選んでください（{sheets.length} 枚見つかりました）。
          </p>
        </div>
      ) : null}

      {/* シートを切り替えたら確定フォームの状態（useActionState）もリセットする。 */}
      <ImportPreview
        key={current.sheet}
        month={current.month}
        result={current.result}
        confirmAction={confirmAction}
      />
    </div>
  );
}

/** アップロード→プレビュー→確定の2ステップを束ねるコンテナ。 */
export function ImportForm({
  parseAction,
  confirmAction,
}: {
  parseAction: ParseAction;
  confirmAction: ConfirmAction;
}) {
  const [state, formAction, pending] = useActionState<
    ImportPreviewState,
    FormData
  >(parseAction, undefined);
  const [fileName, setFileName] = useState<string>("");

  const monthHint = fileName ? parseMonthFromFilename(fileName) : null;

  if (state?.ok) {
    return <ImportResult sheets={state.sheets} confirmAction={confirmAction} />;
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="file">Excel ファイル（.xlsx）</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".xlsx"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileSpreadsheet className="size-3.5" aria-hidden />
          「月々の収支（簡易版）」テンプレートに対応しています。
          {monthHint ? `対象月: ${monthHint}` : ""}
        </p>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full text-base shadow-soft"
        disabled={pending}
      >
        {pending ? "読み込み中..." : "ファイルを読み込む"}
      </Button>
    </form>
  );
}
