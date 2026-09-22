import { AuthForm } from "@/components/features/auth/auth-form";
import { safeNextPath } from "@/lib/route-access";
import { PASSWORD_POLICY_HINT } from "@/lib/validations/auth";

import { signUp } from "../actions";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next, "/households");

  return (
    <AuthForm
      title="新規登録"
      description="メールアドレスとパスワードで登録します"
      submitLabel="登録する"
      action={signUp}
      altText="すでにアカウントをお持ちの方は"
      altHref={`/login?next=${encodeURIComponent(nextPath)}`}
      altLinkLabel="ログイン"
      passwordHint={PASSWORD_POLICY_HINT}
      nextPath={nextPath}
    />
  );
}
