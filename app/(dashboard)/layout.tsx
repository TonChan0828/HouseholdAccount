import { redirect } from "next/navigation";

import { signOut } from "@/app/(auth)/actions";
import { setActiveHousehold } from "@/app/households/actions";
import { AppHeader } from "@/components/features/layout/app-header";
import { MobileTabBar } from "@/components/features/layout/mobile-tab-bar";
import {
  getActiveHouseholdId,
  getCurrentUser,
  getUserHouseholds,
} from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  // proxy.ts でも保護しているが、二重防御として確認する。
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const [{ data: profile }, { data: membership }, households] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("household_members")
        .select("display_name")
        .eq("household_id", householdId)
        .eq("user_id", user.id)
        .maybeSingle(),
      getUserHouseholds(),
    ]);

  // 利用中グループのニックネームを優先し、未設定ならグローバル名にフォールバックする。
  const displayName =
    membership?.display_name ??
    profile?.display_name ??
    user.email ??
    "ユーザー";

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        households={households}
        activeHouseholdId={householdId}
        switchAction={setActiveHousehold}
        displayName={displayName}
        signOutAction={signOut}
      />
      <div className="flex flex-1 flex-col pb-24 lg:pb-0">{children}</div>
      <MobileTabBar />
    </div>
  );
}
