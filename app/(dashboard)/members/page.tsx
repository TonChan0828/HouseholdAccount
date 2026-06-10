import Link from "next/link";
import { redirect } from "next/navigation";

import { MemberActivity, type MemberTxRow } from "@/components/features/members/member-activity";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { buttonVariants } from "@/components/ui/button";
import { getActiveHouseholdId } from "@/lib/household";
import { summarizeByMember, type MemberInfo } from "@/lib/members";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const { data: household } = await supabase
    .from("households")
    .select("period_start_day")
    .eq("id", householdId)
    .maybeSingle();
  const startDay = household?.period_start_day ?? 1;

  const range = getPeriodRange(refFromParam(ref), startDay);
  const isoStart = toISODate(range.start);
  const isoEnd = toISODate(range.end);

  const { data: memberRows } = await supabase
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", householdId)
    .order("joined_at");
  const userIds = (memberRows ?? []).map((m) => m.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const members: MemberInfo[] = userIds.map((id) => ({
    user_id: id,
    display_name: nameById.get(id) ?? "不明なユーザー",
  }));

  const { data } = await supabase
    .from("transactions")
    .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
    .eq("household_id", householdId)
    .gte("date", isoStart)
    .lt("date", isoEnd)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<MemberTxRow[]>();

  const txs = data ?? [];
  const summaries = summarizeByMember(txs, members);

  const prevHref = `/members?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/members?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:py-8">
      <h1 className="text-2xl font-bold">メンバー別アクティビティ</h1>

      <MonthNav
        label={formatPeriodLabel(range)}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      <MemberActivity summaries={summaries} txs={txs} />

      <div className="text-center">
        <Link href="/" className={buttonVariants({ variant: "link" })}>
          ダッシュボードへ
        </Link>
      </div>
    </main>
  );
}
