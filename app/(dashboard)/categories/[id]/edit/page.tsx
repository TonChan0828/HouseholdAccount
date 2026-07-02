import Link from "next/link";
import { redirect } from "next/navigation";

import { updateCategory } from "@/app/(dashboard)/categories/actions";
import { CategoryForm } from "@/components/features/categories/category-form";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import { requireDashboardContext } from "@/lib/household";
import type { Category } from "@/types";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { householdId, supabase } = await requireDashboardContext();

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

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="設定" title="カテゴリを編集" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="pt-6">
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
      </Surface>
      <div className="text-center">
        <Link href="/categories" className={buttonVariants({ variant: "link" })}>
          カテゴリ一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
