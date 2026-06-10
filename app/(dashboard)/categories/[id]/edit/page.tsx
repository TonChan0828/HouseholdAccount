import Link from "next/link";
import { redirect } from "next/navigation";

import { updateCategory } from "@/app/(dashboard)/categories/actions";
import { CategoryForm } from "@/components/features/categories/category-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .eq("household_id", householdId)
    .eq("is_default", false)
    .maybeSingle();
  const category = data as Category | null;

  // 存在しない・デフォルト・他グループのカテゴリは編集対象外
  if (!category) {
    redirect("/categories");
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>カテゴリを編集</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            action={updateCategory}
            submitLabel="更新する"
            defaultValues={{
              id: category.id,
              name: category.name,
              color: category.color,
              type: category.type,
            }}
          />
        </CardContent>
      </Card>
      <div className="text-center">
        <Link href="/categories" className={buttonVariants({ variant: "link" })}>
          カテゴリ一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
