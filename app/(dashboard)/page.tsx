import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveHouseholdId } from "@/lib/household";

export default async function DashboardPage() {
  const householdId = await getActiveHouseholdId();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <div className="flex gap-2">
          <Link
            href="/transactions"
            className={buttonVariants({ variant: "default" })}
          >
            収支を記録
          </Link>
          <Link href="/households" className={buttonVariants({ variant: "outline" })}>
            グループ選択
          </Link>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>ようこそ</CardTitle>
          <CardDescription>
            基盤構築フェーズのプレースホルダ画面です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {householdId
              ? `アクティブなグループ: ${householdId}`
              : "まだ家計簿グループに参加していません。グループ選択から作成してください。"}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
