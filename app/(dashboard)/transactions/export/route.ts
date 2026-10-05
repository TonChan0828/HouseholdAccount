import { type NextRequest, NextResponse } from "next/server";

import { type ExportRow, toTransactionsCsv } from "@/lib/export";
import {
  getActiveHouseholdId,
  getCurrentUser,
  getHouseholdSettings,
} from "@/lib/household";
import { logServerError } from "@/lib/observability";
import { getPeriodRange, toISODate } from "@/lib/period";
import { parseTransactionFilter, escapeLike } from "@/lib/transaction-filter";
import { unwrapData } from "@/lib/queries/result";
import { createClient } from "@/lib/supabase/server";
import { attributedTo, attributionOrFilter } from "@/lib/transactions/attribution";

type TransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  on_behalf_of: string | null;
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

  try {
    const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

    const ref = request.nextUrl.searchParams.get("ref");
    const range = getPeriodRange(refFromParam(ref), startDay);
    const isoStart = toISODate(range.start);
    const isoEnd = toISODate(range.end);
    const filter = parseTransactionFilter(Object.fromEntries(request.nextUrl.searchParams));

    // 取得上限が設定されていても、実際に受け取った件数から次の範囲を取得する。
    // 正確な総件数と一意な並び順で、途中の欠落・重複を検出する。
    const transactions: TransactionRow[] = [];
    const seenIds = new Set<string>();
    let expectedCount: number | null = null;
    do {
      let query = supabase
        .from("transactions")
        .select(
          "id, amount, type, date, memo, created_by, on_behalf_of, category:categories(name)",
          { count: "exact" },
        )
        .eq("household_id", householdId)
        .gte("date", isoStart)
        .lt("date", isoEnd);
      if (filter.type) query = query.eq("type", filter.type);
      if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
      if (filter.createdBy) query = query.or(attributionOrFilter(filter.createdBy));
      if (filter.memoQuery) query = query.ilike("memo", `%${escapeLike(filter.memoQuery)}%`);
      if (filter.minAmount !== undefined) query = query.gte("amount", filter.minAmount);
      if (filter.maxAmount !== undefined) query = query.lte("amount", filter.maxAmount);
      const transactionResult = await query.order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(transactions.length, transactions.length + 499)
        .overrideTypes<TransactionRow[]>();
      const batch = unwrapData(transactionResult, "exportTransactions") ?? [];
      const count = transactionResult.count;
      if (
        count === null ||
        (expectedCount !== null && count !== expectedCount) ||
        (batch.length === 0 && transactions.length < count)
      ) {
        throw new Error("CSV export transaction count changed or is unavailable");
      }
      expectedCount = count;
      for (const transaction of batch) {
        if (seenIds.has(transaction.id)) {
          throw new Error("CSV export contains duplicate transactions");
        }
        seenIds.add(transaction.id);
        transactions.push(transaction);
      }
      if (transactions.length > expectedCount) {
        throw new Error("CSV export transaction count does not match");
      }
    } while (transactions.length < expectedCount);

    // user_id → display_name のマップを作る（dashboard と同じ2段 join パターン）。
    // グループ毎の名前（household_members.display_name）優先・未設定はグローバル名へ。
    const memberResult = await supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", householdId);
    const members = unwrapData(memberResult, "exportHouseholdMembers") ?? [];
    const userIds = members.map((m) => m.user_id);
    const profileResult = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds)
      : { data: [], error: null };
    const profiles = unwrapData(profileResult, "exportMemberProfiles");
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
      // 「登録者」は帰属ユーザー（名義人。spec 41）。代理入力は名義人の名前で出す。
      memberName: nameById.get(attributedTo(t)) ?? null,
    }));

    const csv = toTransactionsCsv(rows);
    const lastDay = toISODate(
      new Date(range.end.getTime() - 24 * 60 * 60 * 1000),
    );
    const filename = `transactions_${isoStart}_${lastDay}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
    logServerError("transactions.export.failed", error, { requestId });
    return Response.json(
      { error: "CSVの作成に失敗しました", requestId },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
