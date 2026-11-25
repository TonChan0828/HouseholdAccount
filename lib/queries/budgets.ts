import type { ServerClient } from "@/lib/household";
import { unwrapData } from "@/lib/queries/result";

export async function fetchHouseholdBudgets(supabase: ServerClient, householdId: string) {
  const result = await supabase.from("budgets").select("category_id, amount").eq("household_id", householdId);
  return unwrapData(result, "fetchHouseholdBudgets") ?? [];
}
