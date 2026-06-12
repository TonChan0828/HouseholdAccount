import { redirect } from "next/navigation";

import { updateProfile } from "@/app/(dashboard)/settings/actions";
import { ProfileForm } from "@/components/features/profile/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    </main>
  );
}
