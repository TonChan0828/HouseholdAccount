import { redirect } from "next/navigation";

import {
  changePassword,
  deleteAccount,
  updateProfile,
} from "@/app/(dashboard)/settings/actions";
import { AccountDeletionForm } from "@/components/features/profile/account-deletion-form";
import { PasswordForm } from "@/components/features/profile/password-form";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール設定</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            action={updateProfile}
            defaultDisplayName={profile?.display_name ?? user.email ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>パスワード変更</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm action={changePassword} />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">アカウント削除</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountDeletionForm
            action={deleteAccount}
            email={user.email ?? ""}
          />
        </CardContent>
      </Card>
    </main>
  );
}
