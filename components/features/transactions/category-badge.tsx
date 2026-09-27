import { CategoryIconMark } from "@/components/features/categories/category-icon-mark";

type Props = {
  category: { name: string; color: string | null; icon?: string | null } | null;
};

/** カテゴリ名を設定済みアイコンまたは色ドットとともに表示する。 */
export function CategoryBadge({ category }: Props) {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        未分類
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 py-0.5 text-xs font-medium">
      <CategoryIconMark
        icon={category.icon ?? null}
        color={category.color}
      />
      {category.name}
    </span>
  );
}
