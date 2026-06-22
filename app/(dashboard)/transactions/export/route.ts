import { type NextRequest, NextResponse } from "next/server";

import { type ExportRow, toTransactionsCsv } from "@/lib/export";
import {
  getActiveHouseholdId,
  getCurrentUser,
  getHouseholdSettings,
} from "@/lib/household";
import { getPeriodRange, toISODate } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";

type TransactionRow = {
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category: { name: string } | null;
};

function refFromParam(ref: string | null): Date {
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    return new Date(`${ref}T00:00:00Z`);
  }
  return new Date();
}

/**
 * 現在表示中の期間（`ref`）の収支を CSV でダウンロードする。
 *
 * 認可は household スコープでサーバー側に閉じ込める（`household_id` + 日付範囲で多層防御）。
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    return new NextResponse("No active household", { status: 403 });
  }

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const ref = request.nextUrl.searchParams.get("ref");
  const range = getPeriodRange(refFromParam(ref), startDay);
  const isoStart = toISODate(range.start);
  const isoEnd = toISODate(range.end);

  const { data } = await supabase
    .from("transactions")
    .select("amount, type, date, memo, created_by, category:categories(name)")
    .eq("household_id", householdId)
    .gte("date", isoStart)
    .lt("date", isoEnd)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .overrideTypes<TransactionRow[]>();
  const transactions = data ?? [];

  // created_by → display_name のマップを作る（dashboard と同じ2段 join パターン）。
  // グループ毎の名前（household_members.display_name）優先・未設定はグローバル名へ。
  const { data: memberRows } = await supabase
    .from("household_members")
    .select("user_id, display_name")
    .eq("household_id", householdId);
  const members = memberRows ?? [];
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  const profileNameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name]),
  );
  const nameById = new Map(
    members.map((m) => [
      m.user_id,
      m.display_name ?? profileNameById.get(m.user_id) ?? null,
    ]),
  );

  const rows: ExportRow[] = transactions.map((t) => ({
    date: t.date,
    type: t.type,
    categoryName: t.category?.name ?? null,
    amount: t.amount,
    memo: t.memo,
    memberName: nameById.get(t.created_by) ?? null,
  }));

  const csv = toTransactionsCsv(rows);
  const lastDay = toISODate(new Date(range.end.getTime() - 24 * 60 * 60 * 1000));
  const filename = `transactions_${isoStart}_${lastDay}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
