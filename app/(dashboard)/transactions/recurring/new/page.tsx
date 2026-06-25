import Link from "next/link";
import { redirect } from "next/navigation";

import { createRecurring } from "@/app/(dashboard)/transactions/recurring/actions";
import { RecurringForm } from "@/components/features/transactions/recurring-form";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types";

export default async function NewRecurringPage() {
  const supabase = await createClient();
  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
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
      <PageHeader eyebrow="記録" title="定期項目を追加" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="pt-6">
          <RecurringForm
            action={createRecurring}
            categories={categories}
            submitLabel="登録する"
          />
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
