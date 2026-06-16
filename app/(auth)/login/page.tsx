import { AuthForm } from "@/components/features/auth/auth-form";

import { signIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;

  return (
    <AuthForm
      title="ログイン"
      description="Shallet にログインします"
      submitLabel="ログイン"
      action={signIn}
      altText="アカウントをお持ちでない方は"
      altHref="/register"
      altLinkLabel="新規登録"
      forgotPasswordHref="/forgot-password"
      notice={deleted === "1" ? "アカウントを削除しました" : undefined}
    />
  );
}
