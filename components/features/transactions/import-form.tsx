"use client";

import { type ReactNode, useActionState, useMemo, useState } from "react";
import { FileSpreadsheet, TrendingDown, TrendingUp } from "lucide-react";

import type {
  ImportConfirmState,
  ImportPreviewState,
  SheetPreview,
} from "@/app/(dashboard)/transactions/import/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberInfo } from "@/lib/members";
import { isIsoCalendarMonth } from "@/lib/period";
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

const ROWS_PER_PAGE = 50;

function PreviewRows<T>({ rows, label, renderRow }: {
  rows: T[];
  label: string;
  renderRow: (row: T, index: number) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const offset = page * ROWS_PER_PAGE;

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.slice(offset, offset + ROWS_PER_PAGE).map((row, index) =>
          renderRow(row, offset + index),
        )}
      </ul>
      {pages > 1 && (
        <nav className="my-2 flex items-center justify-between gap-2" aria-label={`${label}のページ`}>
          <Button type="button" size="sm" variant="outline" disabled={page === 0}
            aria-label={`${label}の前のページ`} onClick={() => setPage(page - 1)}>前へ</Button>
          <span aria-live="polite">{page + 1} / {pages}</span>
          <Button type="button" size="sm" variant="outline" disabled={page === pages - 1}
            aria-label={`${label}の次のページ`} onClick={() => setPage(page + 1)}>次へ</Button>
        </nav>
      )}
    </>
  );
}

/** プレビュー（取込予定・スキップ・エラー）と確定フォーム。表示専用でテスト対象。 */
export function ImportPreview({
  month,
  result,
  onMonthChange,
  sheet,
  initialMember = "",
  members = [],
  onMemberChange,
  confirmAction,
}: {
  month: string;
  onMonthChange?: (value: string) => void;
  sheet?: string;
  initialMember?: string;
  members?: MemberInfo[];
  onMemberChange?: (value: string) => void;
  result: ClassifyResult;
  confirmAction: ConfirmAction;
}) {
  const [state, formAction, pending] = useActionState<
    ImportConfirmState,
    FormData
  >(confirmAction, undefined);

  const [targetMonth, setTargetMonth] = useState(month);
  const [member, setMember] = useState(initialMember);
  const [acceptExclusions, setAcceptExclusions] = useState(false);
  const validMonth = isIsoCalendarMonth(targetMonth);
  const hasValid = result.valid.length > 0;
  const outsideMonth = useMemo(
    () => validMonth ? result.valid.filter((row) => row.date && !row.date.startsWith(targetMonth)).length : 0,
    [result.valid, validMonth, targetMonth],
  );
  const rowsPayload = useMemo(() => JSON.stringify(result.valid), [result.valid]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        取込予定 <strong className="text-foreground">{result.valid.length}</strong> 件
        {result.skipped.length > 0 ? `・スキップ ${result.skipped.length} 件` : ""}
        {result.errors.length > 0 ? `・エラー ${result.errors.length} 件` : ""}
      </p>

      {hasValid ? (
        <PreviewRows rows={result.valid} label="取込予定" renderRow={(r, i) => {
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
                  {r.date && <span className="text-xs text-muted-foreground">{r.date}</span>}
                </span>
                <span className="font-heading font-bold tabular-nums">
                  {yen(r.amount)}
                </span>
              </li>
            );
        }} />
      ) : (
        <p className="text-sm text-destructive">取り込める収支がありません。</p>
      )}

      {result.errors.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">エラー（取り込まれません）</p>
          <PreviewRows rows={result.errors} label="エラー" renderRow={(e) => (
              <li key={`e-${e.row}`}>
                {e.cell ? [sheet, e.cell].filter(Boolean).join(" · ") : `行${e.row}`} {e.item}: {e.reason}
              </li>
          )} />
        </div>
      ) : null}

      {result.skipped.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">
            スキップした費目 {result.skipped.length} 件
          </summary>
          <PreviewRows rows={result.skipped} label="スキップ" renderRow={(s) => (
              <li key={`s-${s.row}`}>
                行{s.row} {s.item}: {s.reason}
              </li>
          )} />
        </details>
      ) : null}

      <form action={formAction} className="space-y-4 border-t border-border pt-4">
        <input
          type="hidden"
          name="rows"
          value={rowsPayload}
        />
        <div className="space-y-2">
          <Label htmlFor="month">対象月</Label>
          <Input
            id="month"
            name="month"
            type="text"
            placeholder="YYYY-MM"
            aria-describedby="import-month-format"
            value={targetMonth}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setTargetMonth(value);
              onMonthChange?.(value);
            }}
            required
          />
          <p id="import-month-format" className="text-xs text-muted-foreground">
            {targetMonth && !validMonth
              ? "実在する年月を YYYY-MM 形式で入力してください。"
              : "YYYY-MM（例 2024-02）。日付のない行はこの月の1日付で登録されます。"}
          </p>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="import-member">名義人</Label>
            <select id="import-member" name="member" className="w-full rounded-md border bg-background p-2"
              value={member}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setMember(value);
                onMemberChange?.(value);
              }}
            >
              <option value="">自分</option>
              {members.map((entry) => <option key={entry.user_id} value={entry.user_id}>{entry.display_name}</option>)}
            </select>
          </div>
        )}

        {outsideMonth > 0 && (
          <p className="text-sm">対象月外の {outsideMonth} 件は、Excel の元の日付で登録します。</p>
        )}
        {(member || result.valid.some((row) => row.date)) && (
          <p className="text-xs text-muted-foreground">
            以前取り込んだ明細に別の日付や名義人を指定すると、新しい明細として登録されます。
          </p>
        )}
        {hasValid && result.errors.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" required checked={acceptExclusions}
              onChange={(event) => setAcceptExclusions(event.currentTarget.checked)} />
            エラーの {result.errors.length} 件を除いて取り込む
          </label>
        )}

        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        {validMonth && (
          <p className="text-sm">
            対象月: {targetMonth.slice(0, 4)}年{Number(targetMonth.slice(5))}月 · {result.valid.length} 件
          </p>
        )}
        <Button
          type="submit"
          className="h-11 w-full text-base shadow-soft"
          disabled={pending || !hasValid || !validMonth || (result.errors.length > 0 && !acceptExclusions)}
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
  members,
}: {
  sheets: SheetPreview[];
  members?: MemberInfo[];
  confirmAction: ConfirmAction;
}) {
  const [selected, setSelected] = useState<string>(sheets[0]?.sheet ?? "");
  const [months, setMonths] = useState(() => new Map<string, string>());
  const [memberBySheet, setMemberBySheet] = useState(() => new Map<string, string>());
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
        month={months.get(current.sheet) ?? current.month}
        onMonthChange={(value) => setMonths((previous) => new Map(previous).set(current.sheet, value))}
        result={current.result}
        sheet={current.sheet}
        initialMember={memberBySheet.get(current.sheet)}
        onMemberChange={(value) => setMemberBySheet((previous) => new Map(previous).set(current.sheet, value))}
        members={members}
        confirmAction={confirmAction}
      />
    </div>
  );
}

/** アップロード→プレビュー→確定の2ステップを束ねるコンテナ。 */
export function ImportForm({
  parseAction,
  confirmAction,
  members,
}: {
  parseAction: ParseAction;
  members?: MemberInfo[];
  confirmAction: ConfirmAction;
}) {
  const [state, formAction, pending] = useActionState<
    ImportPreviewState,
    FormData
  >(parseAction, undefined);
  const [chooseNewFile, setChooseNewFile] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const monthHint = fileName ? parseMonthFromFilename(fileName) : null;

  if (state?.ok && !chooseNewFile && !pending) {
    return (
      <div className="space-y-4">
        <ImportResult sheets={state.sheets} confirmAction={confirmAction} members={members} />
        <Button type="button" variant="outline" onClick={() => { setFileName(""); setChooseNewFile(true); }}>
          別のファイルを選ぶ
        </Button>
      </div>
    );
  }

  return (
    <form action={(data) => { setChooseNewFile(false); formAction(data); }} className="space-y-5">
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
          {state.resetAt && ` 再開予定 ${new Date(state.resetAt).toLocaleString("ja-JP", {
            year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
          })}`}
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
