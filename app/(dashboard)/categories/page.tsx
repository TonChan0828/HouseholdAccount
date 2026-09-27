import Link from "next/link";
import { Bell, Plus } from "lucide-react";

import {
  deleteCategory,
  toggleCategoryReminder,
} from "@/app/(dashboard)/categories/actions";
import { DeleteCategoryButton } from "@/components/features/categories/delete-category-button";
import { CategoryIconMark } from "@/components/features/categories/category-icon-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { requireDashboardContext } from "@/lib/household";
import { cn } from "@/lib/utils";
import { unwrapData } from "@/lib/queries/result";
import type { Category, CategoryType } from "@/types";

const GROUPS: { type: CategoryType; label: string }[] = [
  { type: "expense", label: "支出" },
  { type: "income", label: "収入" },
  { type: "both", label: "両方" },
];

export default async function CategoriesPage() {
  const { householdId, supabase } = await requireDashboardContext();

  const result = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("name", { ascending: true });
  const data = unwrapData(result, "fetchCategories");
  const categories = (data ?? []) as Category[];

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="設定"
        title="カテゴリ"
        className={reveal}
        actions={
          <Link
            href="/categories/new"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            <Plus className="size-4" aria-hidden />
            カテゴリを追加
          </Link>
        }
      />

      <p
        data-testid="category-reminder-note"
        className={cn(
          reveal,
          "flex items-start gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs leading-relaxed text-secondary-foreground",
        )}
        style={{ animationDelay: "30ms" }}
      >
        <Bell className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          通知ONにすると、締め日の3日前までにそのカテゴリの登録が無い場合、
          ダッシュボードでお知らせします。
        </span>
      </p>

      {GROUPS.map((group, gi) => {
        const items = categories.filter((c) => c.type === group.type);
        if (items.length === 0) {
          return null;
        }
        return (
          <section
            key={group.type}
            className={reveal}
            style={{ animationDelay: `${60 + gi * 60}ms` }}
          >
            <SectionHeading>{group.label}</SectionHeading>
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((c) => (
                <li key={c.id}>
                  <Surface
                    variant="raised"
                    data-testid="category-row"
                    className="transition-shadow hover:shadow-lifted"
                  >
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <span className="inline-flex min-w-0 items-center gap-3 text-sm">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary shadow-soft">
                          <CategoryIconMark
                            icon={c.icon}
                            color={c.color}
                            className="size-4"
                          />
                        </span>
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <form action={toggleCategoryReminder}>
                          <input type="hidden" name="id" value={c.id} />
                          <input
                            type="hidden"
                            name="reminder_enabled"
                            value={c.reminder_enabled ? "false" : "true"}
                          />
                          <Button
                            type="submit"
                            variant={c.reminder_enabled ? "default" : "ghost"}
                            size="sm"
                            data-testid="category-reminder-toggle"
                            className="h-8 px-2 text-xs"
                          >
                            {c.reminder_enabled ? "通知ON" : "通知OFF"}
                          </Button>
                        </form>
                        {c.is_default ? (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            デフォルト
                          </span>
                        ) : (
                          <>
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
                          </>
                        )}
                      </span>
                    </CardContent>
                  </Surface>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
