import { AuthForm } from "@/components/features/auth/auth-form";
import { safeNextPath } from "@/lib/route-access";

import { signIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; next?: string }>;
}) {
  const { deleted, next } = await searchParams;
  const nextPath = safeNextPath(next, "/households");
  const continuedNext = nextPath === "/households" ? undefined : nextPath;

  return (
    <AuthForm
      title="ログイン"
      description="Shallet にログインします"
      submitLabel="ログイン"
      action={signIn}
      altText="アカウントをお持ちでない方は"
      altHref={
        continuedNext
          ? `/register?next=${encodeURIComponent(continuedNext)}`
          : "/register"
      }
      altLinkLabel="新規登録"
      forgotPasswordHref="/forgot-password"
      notice={deleted === "1" ? "アカウントを削除しました" : undefined}
      nextPath={continuedNext}
    />
  );
}
