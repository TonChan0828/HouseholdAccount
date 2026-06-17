"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useDemo } from "@/components/features/demo/demo-provider";
import { CategoryForm } from "@/components/features/categories/category-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DemoEditCategoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { getCategory, updateCategoryAction } = useDemo();

  const category = getCategory(params.id);
  // 存在しない・デフォルトカテゴリは編集対象外。
  const editable = category && !category.is_default;

  useEffect(() => {
    if (!editable) {
      router.replace("/demo/categories");
    }
  }, [editable, router]);

  if (!category || !editable) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>カテゴリを編集</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            action={updateCategoryAction}
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
        <Link
          href="/demo/categories"
          className={buttonVariants({ variant: "link" })}
        >
          カテゴリ一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
