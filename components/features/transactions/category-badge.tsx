type Props = {
  category: { name: string; color: string | null } | null;
};

/** カテゴリ名を色ドット付きのピルで表示する（presentational）。 */
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
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: category.color ?? "#999" }}
      />
      {category.name}
    </span>
  );
}
