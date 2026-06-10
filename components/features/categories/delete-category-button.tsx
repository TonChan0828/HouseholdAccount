"use client";

import { Button } from "@/components/ui/button";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  categoryId: string;
};

/** confirm で確認してからカテゴリを削除するボタン。 */
export function DeleteCategoryButton({ action, categoryId }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm("紐づく取引は未分類になります。削除しますか？")
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={categoryId} />
      <Button type="submit" variant="ghost" size="sm">
        削除
      </Button>
    </form>
  );
}
