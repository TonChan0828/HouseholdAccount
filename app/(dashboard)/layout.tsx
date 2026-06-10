import { redirect } from "next/navigation";

import { signOut } from "@/app/(auth)/actions";
import { AppHeader } from "@/components/features/layout/app-header";
import { MobileTabBar } from "@/components/features/layout/mobile-tab-bar";
import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware でも保護しているが、二重防御として確認する。
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const [{ data: household }, { data: profile }] = await Promise.all([
    supabase.from("households").select("name").eq("id", householdId).maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        householdName={household?.name ?? "家計簿グループ"}
        displayName={profile?.display_name ?? user.email ?? "ユーザー"}
        signOutAction={signOut}
      />
      <div className="flex flex-1 flex-col pb-24 md:pb-0">{children}</div>
      <MobileTabBar />
    </div>
  );
}
