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
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapData } from "@/lib/queries/result";

const STATUS_MESSAGE: Record<string, string> = {
  not_found: "この招待リンクは無効です。",
  expired: "この招待リンクは有効期限が切れています。",
  exhausted: "この招待リンクは参加上限に達しています。",
};

const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitePath = `/invite/${token}`;
  // 明らかに不正な形式は DB へ渡さず、正規トークンだけを専用 RPC で確認する。
  // 招待された本人は household_invitations を直接 SELECT できないため、
  // SECURITY DEFINER 関数がグループ名と有効性だけを返す。
  const isValidToken = INVITATION_TOKEN_PATTERN.test(token);
  const [data, userResult] = isValidToken
    ? await Promise.all([
        createAdminClient()
          .rpc("invitation_preview", { _token: token })
          .then((result) => unwrapData(result, "previewInvitation")),
        (await createClient()).auth.getUser(),
      ])
    : [null, null];
  const preview = data?.[0];
  const status = preview?.status ?? "not_found";
  const householdName = preview?.household_name ?? null;
  const user = userResult?.data.user ?? null;

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
          {status === "valid" && user ? (
            <AcceptInviteForm token={token} action={acceptInvitation} />
          ) : status === "valid" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                参加するにはログインが必要です。認証後、この招待画面へ戻ります。
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/login?next=${encodeURIComponent(invitePath)}`}
                  className={buttonVariants({ className: "flex-1" })}
                >
                  ログインして参加
                </Link>
                <Link
                  href={`/register?next=${encodeURIComponent(invitePath)}`}
                  className={buttonVariants({
                    variant: "outline",
                    className: "flex-1",
                  })}
                >
                  新規登録して参加
                </Link>
              </div>
            </div>
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
