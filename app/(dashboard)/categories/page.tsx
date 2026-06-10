import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteCategory } from "@/app/(dashboard)/categories/actions";
import { DeleteCategoryButton } from "@/components/features/categories/delete-category-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryType } from "@/types";

const GROUPS: { type: CategoryType; label: string }[] = [
  { type: "expense", label: "支出" },
  { type: "income", label: "収入" },
  { type: "both", label: "両方" },
];

export default async function CategoriesPage() {
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

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("name", { ascending: true });
  const categories = (data ?? []) as Category[];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">カテゴリ</h1>
        <Link
          href="/categories/new"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          カテゴリを追加
        </Link>
      </div>

      {GROUPS.map((group) => {
        const items = categories.filter((c) => c.type === group.type);
        if (items.length === 0) {
          return null;
        }
        return (
          <section key={group.type} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {group.label}
            </h2>
            <ul className="space-y-2">
              {items.map((c) => (
                <li key={c.id}>
                  <Card data-testid="category-row">
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                        <span
                          className="inline-block size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color ?? "#999" }}
                        />
                        <span className="truncate">{c.name}</span>
                      </span>
                      {c.is_default ? (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          デフォルト
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-2">
                          <Link
                            href={`/categories/${c.id}/edit`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                          >
                            編集
                          </Link>
                          <DeleteCategoryButton
                            action={deleteCategory}
                            categoryId={c.id}
                          />
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="text-center">
        <Link href="/" className={buttonVariants({ variant: "link" })}>
          ダッシュボードへ
        </Link>
      </div>
    </main>
  );
}
