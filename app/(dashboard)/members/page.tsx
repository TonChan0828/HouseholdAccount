import { MemberActivity, type MemberTxRow } from "@/components/features/members/member-activity";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { PageHeader } from "@/components/shared/page-header";
import {
  getHouseholdSettings,
  requireDashboardContext,
} from "@/lib/household";
import { summarizeByMember } from "@/lib/members";
import { getHouseholdMemberNames } from "@/lib/queries/members";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";
import { ensureRecurringGenerated } from "@/lib/recurring";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";

function refFromParam(ref: string | undefined): Date {
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    return new Date(`${ref}T00:00:00Z`);
  }
  return new Date();
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const { householdId, supabase } = await requireDashboardContext();

  // 当期分の定期収支を（未生成なら）生成してから集計する。冪等。
  await ensureRecurringGenerated(householdId);

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const range = getPeriodRange(refFromParam(ref), startDay);

  const members = await getHouseholdMemberNames(householdId);
  const txs: MemberTxRow[] = await fetchTransactionsInRange(
    supabase,
    householdId,
    range,
  );
  const summaries = summarizeByMember(txs, members);

  const prevHref = `/members?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/members?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="メンバー"
        title="メンバー別アクティビティ"
        className={reveal}
        actions={
          <MonthNav
            label={formatPeriodLabel(range)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
      />

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <MemberActivity summaries={summaries} txs={txs} />
      </div>
    </main>
  );
}
