import Link from "next/link";

import { acceptInvitation } from "@/app/households/actions";
import { AcceptInviteForm } from "@/components/features/household/accept-invite-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const STATUS_MESSAGE: Record<string, string> = {
  not_found: "この招待リンクは無効です。",
  expired: "この招待リンクは有効期限が切れています。",
  exhausted: "この招待リンクは参加上限に達しています。",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // 招待された本人は household_invitations を直接 SELECT できないため、
  // SECURITY DEFINER 関数でグループ名と有効性だけを取得する。
  const { data } = await supabase.rpc("invitation_preview", { _token: token });
  const preview = data?.[0];
  const status = preview?.status ?? "not_found";
  const householdName = preview?.household_name ?? null;

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>家計簿グループへの招待</CardTitle>
          <CardDescription>
            {status === "valid" && householdName
              ? `「${householdName}」に招待されています。`
              : "招待内容を確認できませんでした。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "valid" ? (
            <AcceptInviteForm token={token} action={acceptInvitation} />
          ) : (
            <p className="text-sm text-destructive" role="alert">
              {STATUS_MESSAGE[status] ?? "この招待リンクは利用できません。"}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          <Link
            href="/households"
            className={buttonVariants({ variant: "outline" })}
          >
            グループ一覧へ
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
