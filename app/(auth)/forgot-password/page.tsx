import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";

import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm action={requestPasswordReset} />;
}
