import { AuthForm } from "@/components/features/auth/auth-form";

import { signIn } from "../actions";

export default function LoginPage() {
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
    />
  );
}
