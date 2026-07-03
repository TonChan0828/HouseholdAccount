import { CardContent } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";
import { yen } from "@/lib/format";
import type { SettlementResult } from "@/lib/settlement";
import { cn } from "@/lib/utils";

/**
 * 精算結果の表示（当期の再計算 or 精算済みスナップショットの両方で使う）。
 * 合計・1人あたり負担額・メンバー別の立替と差額・送金案を並べる。
 */
export function SettlementView({ result }: { result: SettlementResult }) {
  const nameById = new Map(result.rows.map((r) => [r.userId, r.displayName]));

  return (
    <div className="space-y-4">
      <Surface variant="raised">
        <CardContent className="grid grid-cols-2 gap-3 py-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              精算対象の支出合計
            </p>
            <p className="font-heading text-lg font-bold tabular-nums">
              {yen(result.total)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              1人あたり負担額
            </p>
            <p className="font-heading text-lg font-bold tabular-nums">
              {yen(result.perMember)}
            </p>
          </div>
        </CardContent>
      </Surface>

      <div className="grid gap-2 sm:grid-cols-2">
        {result.rows.map((row) => (
          <Surface
            key={row.userId}
            variant="raised"
            data-testid="settlement-member-row"
          >
            <CardContent className="space-y-1 py-4">
              <p className="text-sm font-medium">{row.displayName}</p>
              <p className="text-xs text-muted-foreground">
                立替 {yen(row.paid)}
              </p>
              <p
                className={cn(
                  "text-sm font-bold tabular-nums",
                  row.balance > 0
                    ? "text-income"
                    : row.balance < 0
                      ? "text-expense"
                      : "text-muted-foreground",
                )}
              >
                {row.balance > 0
                  ? `${yen(row.balance)} 受け取る`
                  : row.balance < 0
                    ? `${yen(-row.balance)} 支払う`
                    : "過不足なし"}
              </p>
            </CardContent>
          </Surface>
        ))}
      </div>

      {result.transfers.length > 0 ? (
        <Surface variant="raised">
          <CardContent className="space-y-2 py-4">
            <p className="text-xs font-medium text-muted-foreground">送金案</p>
            <ul className="space-y-1.5">
              {result.transfers.map((t, i) => (
                <li
                  key={i}
                  data-testid="settlement-transfer"
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {nameById.get(t.fromUserId) ?? "不明なユーザー"} →{" "}
                    {nameById.get(t.toUserId) ?? "不明なユーザー"}
                  </span>
                  <span className="font-heading font-bold tabular-nums">
                    {yen(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Surface>
      ) : (
        <p className="text-sm text-muted-foreground">
          送金の必要はありません。
        </p>
      )}
    </div>
  );
}
