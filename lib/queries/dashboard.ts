import { fetchHouseholdBudgets } from "@/lib/queries/budgets";
import { fetchReminderCategories } from "@/lib/queries/categories";
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

    const savedResult = await supabase.rpc("savings_goal_balance", {
      _household_id: householdId,
      _start_date: goal.start_date,
    });
    const saved = unwrapData(savedResult, "fetchSavingsBalance") ?? 0;

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
    fetchHouseholdBudgets(supabase, householdId),
    loadSavingsGoal(),
    fetchReminderCategories(supabase, householdId),
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
