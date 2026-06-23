import Link from "next/link";

import { resendConfirmation } from "@/app/(auth)/actions";
import { ResendConfirmation } from "@/components/features/auth/resend-confirmation";
import { Surface } from "@/components/shared/surface";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Surface variant="raised" className="w-full">
      <CardHeader>
        <CardTitle>確認メールを送信しました</CardTitle>
        <CardDescription>
          登録を完了するにはメールアドレスの認証が必要です
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              <span className="font-medium text-foreground">{email}</span> 宛に
              確認メールを送信しました。
            </>
          ) : (
            "ご登録のメールアドレス宛に確認メールを送信しました。"
          )}
          メール内のリンクをクリックして登録を完了してください。
        </p>
        <p className="text-sm text-muted-foreground">
          メールが届かない場合は、迷惑メールフォルダをご確認のうえ、下のボタンから再送信してください。
        </p>
        {email ? (
          <ResendConfirmation email={email} action={resendConfirmation} />
        ) : null}
      </CardContent>
      <CardFooter className="mt-6 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          認証が完了したら{" "}
          <Link
            href="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            ログイン
          </Link>{" "}
          してください。
        </p>
      </CardFooter>
    </Surface>
  );
}
