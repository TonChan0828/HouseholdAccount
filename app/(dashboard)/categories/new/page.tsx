import Link from "next/link";

import { createCategory } from "@/app/(dashboard)/categories/actions";
import { CategoryForm } from "@/components/features/categories/category-form";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";

export default function NewCategoryPage() {
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="設定" title="カテゴリを追加" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="pt-6">
          <CategoryForm action={createCategory} submitLabel="追加する" />
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
