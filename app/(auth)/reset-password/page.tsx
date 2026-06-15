import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

import { updatePassword } from "../actions";

export default function ResetPasswordPage() {
  return <ResetPasswordForm action={updatePassword} />;
}
