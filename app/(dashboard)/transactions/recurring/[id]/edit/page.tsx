import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteRecurring,
  updateRecurring,
} from "@/app/(dashboard)/transactions/recurring/actions";
import { RecurringForm } from "@/components/features/transactions/recurring-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import { getActiveHouseholdId, getCurrentUser } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types";

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const { data: recurring } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // 存在しない、または登録者本人でなければ一覧へ戻す（編集は本人のみ）。
  if (!recurring || recurring.created_by !== user.id) {
    redirect("/transactions/recurring");
  }

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  const categories = (data ?? []) as Category[];

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="記録" title="定期項目を編集" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="space-y-4 pt-6">
          <RecurringForm
            action={updateRecurring}
            categories={categories}
            submitLabel="更新する"
            defaultValues={{
              id: recurring.id,
              type: recurring.type,
              amount: recurring.amount,
              category_id: recurring.category_id,
              memo: recurring.memo,
              is_active: recurring.is_active,
            }}
          />
          <form action={deleteRecurring} className="border-t pt-4">
            <input type="hidden" name="id" value={recurring.id} />
            <Button type="submit" variant="destructive" className="w-full">
              この定期項目を削除
            </Button>
          </form>
        </CardContent>
      </Surface>
      <div className="text-center">
        <Link
          href="/transactions/recurring"
          className={buttonVariants({ variant: "link" })}
        >
          定期項目の一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
