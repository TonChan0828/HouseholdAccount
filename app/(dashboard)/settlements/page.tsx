import { HandCoins } from "lucide-react";

import {
  CancelSettlementButton,
  SettleButton,
} from "@/components/features/settlements/settle-controls";
import { SettlementView } from "@/components/features/settlements/settlement-view";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import {
  getHouseholdSettings,
  requireDashboardContext,
} from "@/lib/household";
import {
  formatPeriodLabel,
  getPeriodRange,
  refFromParam,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { getHouseholdMemberNames } from "@/lib/queries/members";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";
import { ensureRecurringGenerated } from "@/lib/recurring";
import {
  buildSettlement,
  settlementsEqual,
  type SettlementResult,
} from "@/lib/settlement";

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const { user, householdId, supabase } = await requireDashboardContext();

  // 当期分の定期収支を（未生成なら）生成してから集計する。冪等。
  await ensureRecurringGenerated(householdId);

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);
  const range = getPeriodRange(refFromParam(ref), startDay);
  const periodStart = toISODate(range.start);

  const [txs, members, { data: settlement }] = await Promise.all([
    fetchTransactionsInRange(supabase, householdId, range),
    getHouseholdMemberNames(householdId),
    supabase
      .from("settlements")
      .select("id, settled_by, settled_at, snapshot")
      .eq("household_id", householdId)
      .eq("period_start", periodStart)
      .maybeSingle(),
  ]);

  const current = buildSettlement(txs, members);
  // 精算済みなら記録時点のスナップショットを表示する（後の取引編集に影響されない）。
  const snapshot = settlement
    ? (settlement.snapshot as unknown as SettlementResult)
    : null;
  const hasDiff = snapshot ? !settlementsEqual(snapshot, current) : false;
  const settledByName = settlement
    ? (members.find((m) => m.user_id === settlement.settled_by)?.display_name ??
      "不明なユーザー")
    : null;

  const prevHref = `/settlements?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/settlements?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="管理"
        title="精算"
        className={reveal}
        actions={
          <MonthNav
            label={formatPeriodLabel(range)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
      />

      {members.length < 2 ? (
        <Surface variant="raised" className={reveal}>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <HandCoins className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              精算の必要はありません。
              <br />
              メンバーが2人以上になると立て替えの精算ができます。
            </p>
          </CardContent>
        </Surface>
      ) : settlement && snapshot ? (
        <section
          className={reveal}
          style={{ animationDelay: "60ms" }}
          data-testid="settlement-settled"
        >
          <Surface variant="raised">
            <CardContent className="space-y-3 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-income/15 px-3 py-1 text-xs font-bold text-income">
                  精算済み
                </span>
                <span className="text-xs text-muted-foreground">
                  {settledByName} さんが{" "}
                  {new Date(settlement.settled_at).toLocaleDateString("ja-JP")}{" "}
                  に確定
                </span>
              </div>
              {hasDiff ? (
                <p className="text-sm text-destructive" role="alert">
                  現在の記帳内容と差異があります（精算後に対象の収支が変更されています）
                </p>
              ) : null}
            </CardContent>
          </Surface>
          <div className="mt-4">
            <SettlementView result={snapshot} />
          </div>
          {settlement.settled_by === user.id ? (
            <div className="mt-4">
              <CancelSettlementButton settlementId={settlement.id} />
            </div>
          ) : null}
        </section>
      ) : current.total === 0 ? (
        <Surface variant="raised" className={reveal}>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <HandCoins className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              この期間に精算対象の支出はありません。
              <br />
              収支の登録時に「精算対象（割り勘）」を付けると、ここで均等割りできます。
            </p>
          </CardContent>
        </Surface>
      ) : (
        <section className={reveal} style={{ animationDelay: "60ms" }}>
          <SettlementView result={current} />
          <div className="mt-4">
            <SettleButton refParam={periodStart} />
          </div>
        </section>
      )}
    </main>
  );
}
