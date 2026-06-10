import { Card, CardContent } from "@/components/ui/card";

type Props = {
  income: number;
  expense: number;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** 収入計・支出計・収支差を 3 カードで表示する（presentational）。 */
export function SummaryCards({ income, expense }: Props) {
  return (
    <Card data-testid="summary-cards">
      <CardContent className="grid grid-cols-3 gap-2 py-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">収入</p>
          <p className="font-semibold text-income tabular-nums">
            {yen(income)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">支出</p>
          <p className="font-semibold text-expense tabular-nums">
            {yen(expense)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">収支</p>
          <p className="font-semibold tabular-nums">{yen(income - expense)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
