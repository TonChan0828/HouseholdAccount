type DailyTransaction = {
  date: string;
  amount: number;
  type: "income" | "expense";
};

/** 絞り込み条件に一致する全件から、ページ区切りに依存しない日計を求める。 */
export function calculateDailyTotals(transactions: readonly DailyTransaction[]) {
  const totals = new Map<string, { income: number; expense: number }>();
  for (const transaction of transactions) {
    const total = totals.get(transaction.date) ?? { income: 0, expense: 0 };
    total[transaction.type] += transaction.amount;
    totals.set(transaction.date, total);
  }
  return totals;
}
