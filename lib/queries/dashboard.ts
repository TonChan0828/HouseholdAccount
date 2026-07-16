import type { ServerClient } from "@/lib/household";
import { getHouseholdMemberNames } from "@/lib/queries/members";
import { unwrapData } from "@/lib/queries/result";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";
import { buildSavingsProgress, type SavingsProgress } from "@/lib/savings-goal";

type DateRange = { start: Date; end: Date };

export async function loadDashboardData(
  supabase: ServerClient,
  householdId: string,
  ranges: { current: DateRange; previous: DateRange },
  now = new Date(),
) {
  const loadBudgets = async () => {
    const result = await supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("household_id", householdId);
    return unwrapData(result, "fetchDashboardBudgets") ?? [];
  };

  const loadReminderTargets = async () => {
    const result = await supabase
      .from("categories")
      .select("id, name")
      .eq("household_id", householdId)
      .eq("reminder_enabled", true);
    return unwrapData(result, "fetchReminderCategories") ?? [];
  };

  const loadSavingsGoal = async (): Promise<{
    progress: SavingsProgress | null;
    goal: { start_date: string; target_date: string | null } | null;
  }> => {
    const goalResult = await supabase
      .from("savings_goals")
      .select("name, target_amount, start_date, target_date")
      .eq("household_id", householdId)
      .maybeSingle();
    const goal = unwrapData(goalResult, "fetchSavingsGoal");
    if (!goal) return { progress: null, goal: null };

    const savedResult = await supabase
      .from("transactions")
      .select("amount, type")
      .eq("household_id", householdId)
      .gte("date", goal.start_date);
    const savedRows = unwrapData(savedResult, "fetchSavingsTransactions");
    const saved = (savedRows ?? []).reduce(
      (sum, transaction) =>
        sum +
        (transaction.type === "income"
          ? transaction.amount
          : -transaction.amount),
      0,
    );

    return {
      progress: buildSavingsProgress(
        {
          name: goal.name,
          targetAmount: goal.target_amount,
          startDate: goal.start_date,
          targetDate: goal.target_date,
        },
        saved,
        now,
      ),
      goal: { start_date: goal.start_date, target_date: goal.target_date },
    };
  };

  const [
    transactions,
    previousTransactions,
    members,
    budgets,
    savingsGoal,
    reminderTargets,
  ] = await Promise.all([
    fetchTransactionsInRange(supabase, householdId, ranges.current),
    fetchTransactionsInRange(supabase, householdId, ranges.previous),
    getHouseholdMemberNames(householdId),
    loadBudgets(),
    loadSavingsGoal(),
    loadReminderTargets(),
  ]);

  return {
    transactions,
    previousTransactions,
    members,
    budgets,
    savingsGoal,
    reminderTargets,
  };
}
