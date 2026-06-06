import { AuthForm } from "@/components/features/auth/auth-form";

import { signUp } from "../actions";

export default function RegisterPage() {
  return (
    <AuthForm
      title="新規登録"
      description="メールアドレスとパスワードで登録します"
      submitLabel="登録する"
      action={signUp}
      altText="すでにアカウントをお持ちの方は"
      altHref="/login"
      altLinkLabel="ログイン"
    />
  );
}
