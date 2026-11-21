import Link from "next/link";
import { ArrowDown, ArrowUp, Bell, Plus } from "lucide-react";

import {
  deleteCategory,
  reorderCategories,
  setPresetCategoryVisibility,
  toggleCategoryReminder,
} from "@/app/(dashboard)/categories/actions";
import { DeleteCategoryButton } from "@/components/features/categories/delete-category-button";
import { CategoryIconMark } from "@/components/features/categories/category-icon-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { isHouseholdOwner, requireDashboardContext } from "@/lib/household";
import { cn } from "@/lib/utils";
import { unwrapData } from "@/lib/queries/result";
import type { Category, CategoryType } from "@/types";

const GROUPS: { type: CategoryType; label: string }[] = [
  { type: "expense", label: "支出" },
  { type: "income", label: "収入" },
  { type: "both", label: "両方" },
];

function moveCategoryIds(
  ids: string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ids.length) {
    return ids;
  }
  const next = [...ids];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ sortError?: string; deleted?: string; merged?: string; visibilityError?: string }>;
}) {
  const [{ sortError, deleted, merged, visibilityError }, { householdId, supabase, user }] = await Promise.all([
    searchParams,
    requireDashboardContext(),
  ]);

  const [result, isOwner] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    isHouseholdOwner(supabase, householdId, user.id),
  ]);
  const categories = (unwrapData(result, "fetchCategories") ?? []) as Category[];
  const hiddenCategories = categories.filter((category) => category.is_hidden);
  const usage = isOwner
    ? unwrapData(await supabase.rpc("category_usage", { _household_id: householdId }), "fetchCategoryUsage") ?? []
    : [];
  const usageByCategory = new Map(usage.map((entry) => [entry.category_id, entry]));

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

      {sortError ? (
        <p role="alert" className="text-sm text-destructive">
          {sortError === "conflict"
            ? "カテゴリ一覧が更新されたため、並び替えを保存できませんでした。最新の一覧からやり直してください。"
            : "カテゴリの並び替え内容を確認できませんでした。最新の一覧からやり直してください。"}
        </p>
      ) : null}

      {visibilityError === "1" && (
        <p role="alert" className="text-sm text-destructive">カテゴリの表示設定を変更できませんでした。</p>
      )}

      {merged === "1" && (
        <p role="status" className="rounded-xl bg-secondary px-3 py-2.5 text-sm">カテゴリを統合しました。</p>
      )}

      {deleted === "1" ? (
        <p
          role="status"
          data-testid="category-deleted-notice"
          className="rounded-xl bg-secondary px-3 py-2.5 text-sm text-secondary-foreground"
        >
          カテゴリを削除しました。
        </p>
      ) : null}

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
        const groupCategories = categories.filter((category) => category.type === group.type);
        const items = groupCategories.filter((category) => !category.is_hidden);
        const itemIds = items.map((category) => category.id);
        const reordered = (index: number, direction: -1 | 1) => {
          const visibleIds = moveCategoryIds(itemIds, index, direction);
          let visibleIndex = 0;
          return groupCategories.map((category) => category.is_hidden ? category.id : visibleIds[visibleIndex++]);
        };
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
              {items.map((c, index) => (
                <li key={c.id}>
                  <Surface
                    variant="raised"
                    data-testid="category-row"
                    className="transition-shadow hover:shadow-lifted"
                  >
                    <CardContent className="flex flex-col items-start gap-2 py-3">
                      <span className="inline-flex w-full min-w-0 items-center gap-3 text-sm">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary shadow-soft">
                          <CategoryIconMark
                            icon={c.icon}
                            color={c.color}
                            className="size-4"
                          />
                        </span>
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      <span className="flex w-full flex-wrap items-center justify-end gap-1">
                        <form action={reorderCategories}>
                          <input type="hidden" name="type" value={group.type} />
                          <input
                            type="hidden"
                            name="category_ids"
                            value={JSON.stringify(reordered(index, -1))}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label={`${c.name}を上へ移動`}
                            title="上へ移動"
                            disabled={index === 0}
                            data-testid="category-move-up"
                          >
                            <ArrowUp className="size-4" aria-hidden />
                          </Button>
                        </form>
                        <form action={reorderCategories}>
                          <input type="hidden" name="type" value={group.type} />
                          <input
                            type="hidden"
                            name="category_ids"
                            value={JSON.stringify(reordered(index, 1))}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label={`${c.name}を下へ移動`}
                            title="下へ移動"
                            disabled={index === items.length - 1}
                            data-testid="category-move-down"
                          >
                            <ArrowDown className="size-4" aria-hidden />
                          </Button>
                        </form>
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
                          <>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              デフォルト
                            </span>
                            <form action={setPresetCategoryVisibility}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="hidden" value="true" />
                              <Button variant="ghost" size="sm" type="submit" aria-label={`${c.name}を非表示`}>
                                非表示
                              </Button>
                            </form>
                          </>
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
                              categoryName={c.name}
                              usage={usageByCategory.get(c.id)}
                              destinations={isOwner ? categories
                                .filter((target) => target.id !== c.id && !target.is_hidden &&
                                  (target.type === c.type || target.type === "both"))
                                .map(({ id, name }) => ({ id, name })) : undefined}
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
      {hiddenCategories.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            非表示のカテゴリ（{hiddenCategories.length}件）
          </summary>
          <ul className="mt-2 divide-y">
            {hiddenCategories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                {category.name}
                <form action={setPresetCategoryVisibility}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="hidden" value="false" />
                  <Button type="submit" size="sm" variant="outline" aria-label={`${category.name}を再表示`}>
                    再表示
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
