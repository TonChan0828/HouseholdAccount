import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import {
  createHousehold,
  createInvitation,
  revokeInvitation,
  setActiveHousehold,
  setPeriodStartDay,
  updateInvitation,
} from "@/app/households/actions";
import { CreateHouseholdForm } from "@/components/features/household/create-household-form";
import { InvitationManager } from "@/components/features/household/invitation-manager";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdInvitation, MemberRole } from "@/types";

type MembershipRow = {
  role: MemberRole;
  household: { id: string; name: string; period_start_day: number } | null;
};

export default async function HouseholdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("household_members")
    .select("role, household:households(id, name, period_start_day)")
    .order("joined_at", { ascending: true })
    .overrideTypes<MembershipRow[]>();

  const groups = (memberships ?? []).filter((m) => m.household !== null);
  const activeId = await getActiveHouseholdId();

  // RLS により、自分が owner のグループの招待リンクのみ取得できる。
  const { data: invitationRows } = await supabase
    .from("household_invitations")
    .select("*")
    .order("created_at", { ascending: false });
  const invitations = (invitationRows ?? []) as HouseholdInvitation[];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">家計簿グループ</h1>
          <p className="text-sm text-muted-foreground">
            ログイン中: {user?.email}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            ログアウト
          </Button>
        </form>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            まだ参加しているグループがありません。下のフォームから新しいグループを作成しましょう。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {groups.map(({ role, household }) => {
            const group = household!;
            const isActive = group.id === activeId;
            const groupInvitations = invitations.filter(
              (inv) => inv.household_id === group.id,
            );
            return (
              <li key={group.id}>
                <Card data-testid="household-card">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        {group.name}
                        {role === "owner" ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                            オーナー
                          </span>
                        ) : null}
                      </CardTitle>
                      {isActive ? (
                        <span
                          className="text-sm font-medium text-primary"
                          data-testid="active-badge"
                        >
                          利用中
                        </span>
                      ) : (
                        <form action={setActiveHousehold}>
                          <input
                            type="hidden"
                            name="household_id"
                            value={group.id}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            このグループに切り替え
                          </Button>
                        </form>
                      )}
                    </div>
                  </CardHeader>
                  {role === "owner" ? (
                    <CardContent className="space-y-6">
                      <div>
                        <p className="mb-2 text-sm font-medium">月の区切り</p>
                        <form
                          action={setPeriodStartDay}
                          className="flex items-end gap-2"
                        >
                          <input
                            type="hidden"
                            name="household_id"
                            value={group.id}
                          />
                          <div className="space-y-1">
                            <label
                              htmlFor={`start-day-${group.id}`}
                              className="text-xs text-muted-foreground"
                            >
                              開始日（1〜28）
                            </label>
                            <input
                              id={`start-day-${group.id}`}
                              name="period_start_day"
                              type="number"
                              min={1}
                              max={28}
                              defaultValue={group.period_start_day}
                              className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                          </div>
                          <Button type="submit" variant="outline" size="sm">
                            保存
                          </Button>
                        </form>
                      </div>
                      <div>
                        <p className="mb-3 text-sm font-medium">メンバーを招待</p>
                        <InvitationManager
                          householdId={group.id}
                          invitations={groupInvitations}
                          createAction={createInvitation}
                          updateAction={updateInvitation}
                          revokeAction={revokeInvitation}
                        />
                      </div>
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>新しいグループを作成</CardTitle>
          <CardDescription>
            作成者は自動的にオーナーになります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateHouseholdForm action={createHousehold} />
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href="/" className={buttonVariants({ variant: "link" })}>
          ダッシュボードへ
        </Link>
      </div>
    </div>
  );
}
