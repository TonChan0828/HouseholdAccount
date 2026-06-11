import { Card, CardContent } from "@/components/ui/card";
import type {
  CategoryMemberMatrix as Matrix,
  MatrixSection,
} from "@/lib/category-matrix";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  matrix: Matrix;
};

function amountCell(value: number) {
  if (value === 0) {
    return <span className="text-muted-foreground/50">-</span>;
  }
  return yen(value);
}

function MatrixTable({
  label,
  tone,
  section,
  members,
  testId,
}: {
  label: string;
  tone: string;
  section: MatrixSection;
  members: Matrix["members"];
  testId: string;
}) {
  return (
    <Card className="shadow-soft ring-0" data-testid={testId}>
      <CardContent className="space-y-2 py-4 max-sm:px-3">
        <p className={cn("text-xs font-semibold", tone)}>{label}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border/70 text-muted-foreground">
                <th className="sticky left-0 bg-card py-1.5 pr-2 text-left font-medium">
                  カテゴリ
                </th>
                {members.map((m) => (
                  <th
                    key={m.userId}
                    className="max-w-[8rem] truncate py-1.5 pl-2 text-right font-medium"
                  >
                    {m.displayName}
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-right font-medium">合計</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr
                  key={row.categoryId ?? "__none__"}
                  className="border-b border-border/40"
                >
                  <td className="sticky left-0 bg-card py-1.5 pr-2">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        aria-hidden
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.name}
                    </span>
                  </td>
                  {row.cells.map((value, i) => (
                    <td
                      key={members[i].userId}
                      className="py-1.5 pl-2 text-right tabular-nums"
                    >
                      {amountCell(value)}
                    </td>
                  ))}
                  <td className="py-1.5 pl-2 text-right font-medium tabular-nums">
                    {amountCell(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={cn("font-bold", tone)}>
                <td className="sticky left-0 bg-card py-1.5 pr-2">合計</td>
                {section.memberTotals.map((value, i) => (
                  <td
                    key={members[i].userId}
                    className="py-1.5 pl-2 text-right tabular-nums"
                  >
                    {amountCell(value)}
                  </td>
                ))}
                <td className="py-1.5 pl-2 text-right tabular-nums">
                  {amountCell(section.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** 行=カテゴリ / 列=メンバーの収支マトリクスを支出・収入別に表示する（presentational）。 */
export function CategoryMemberMatrix({ matrix }: Props) {
  const hasExpense = matrix.expense.rows.length > 0;
  const hasIncome = matrix.income.rows.length > 0;
  if (!hasExpense && !hasIncome) return null;

  return (
    <section className="space-y-2" data-testid="category-member-matrix">
      <h2 className="font-heading text-base font-bold">メンバー別カテゴリ</h2>
      <div className="space-y-3">
        {hasExpense ? (
          <MatrixTable
            label="支出"
            tone="text-expense"
            section={matrix.expense}
            members={matrix.members}
            testId="matrix-expense"
          />
        ) : null}
        {hasIncome ? (
          <MatrixTable
            label="収入"
            tone="text-income"
            section={matrix.income}
            members={matrix.members}
            testId="matrix-income"
          />
        ) : null}
      </div>
    </section>
  );
}
