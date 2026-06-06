import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function HouseholdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>家計簿グループ</CardTitle>
          <CardDescription>ログイン中: {user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            グループの作成・招待・切り替え機能は次のフェーズで実装します。
          </p>
        </CardContent>
        <CardFooter className="mt-6 flex items-center justify-between">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            ダッシュボードへ
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost">
              ログアウト
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
