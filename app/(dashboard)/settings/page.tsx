import { redirect } from "next/navigation";

import {
  changePassword,
  deleteAccount,
  updateProfile,
} from "@/app/(dashboard)/settings/actions";
import { AccountDeletionForm } from "@/components/features/profile/account-deletion-form";
import { PasswordForm } from "@/components/features/profile/password-form";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
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

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-6 p-4 sm:py-8">
      <PageHeader eyebrow="アカウント" title="設定" className={reveal} />

      <section className={reveal} style={{ animationDelay: "60ms" }}>
        <SectionHeading>プロフィール設定</SectionHeading>
        <Surface variant="raised">
          <CardContent className="pt-6">
            <ProfileForm
              action={updateProfile}
              defaultDisplayName={profile?.display_name ?? user.email ?? ""}
            />
          </CardContent>
        </Surface>
      </section>

      <section className={reveal} style={{ animationDelay: "120ms" }}>
        <SectionHeading>パスワード変更</SectionHeading>
        <Surface variant="raised">
          <CardContent className="pt-6">
            <PasswordForm action={changePassword} />
          </CardContent>
        </Surface>
      </section>

      <section className={reveal} style={{ animationDelay: "180ms" }}>
        <SectionHeading>アカウント削除</SectionHeading>
        <Surface variant="flat" className="ring-destructive/30">
          <CardContent className="pt-6">
            <AccountDeletionForm
              action={deleteAccount}
              email={user.email ?? ""}
            />
          </CardContent>
        </Surface>
      </section>
    </main>
  );
}
