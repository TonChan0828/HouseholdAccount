import Link from "next/link";

import { createCategory } from "@/app/(dashboard)/categories/actions";
import { CategoryForm } from "@/components/features/categories/category-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewCategoryPage() {
  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>カテゴリを追加</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm action={createCategory} submitLabel="追加する" />
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
