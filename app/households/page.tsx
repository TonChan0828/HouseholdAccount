import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check, LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { ShalletLogo } from "@/components/shallet-logo";
import {
  createHousehold,
  createInvitation,
  deleteHousehold,
  leaveHousehold,
  removeMember,
  revokeInvitation,
  setActiveHousehold,
  setPeriodStartDay,
  transferOwnership,
  updateGroupDisplayName,
  updateInvitation,
} from "@/app/households/actions";
import { CreateHouseholdForm } from "@/components/features/household/create-household-form";
import { DeleteHouseholdDialog } from "@/components/features/household/delete-household-dialog";
import { GroupDisclosure } from "@/components/features/household/group-disclosure";
import { InvitationManager } from "@/components/features/household/invitation-manager";
import {
  MemberList,
  type MemberListItem,
} from "@/components/features/household/member-list";
import { ThemeToggleButton } from "@/components/features/layout/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
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
  if (!user) {
    redirect("/login");
  }

  // RLS は同居メンバー全員の行を返すため、自分の所属行に絞る（重複表示防止）。
  const { data: memberships } = await supabase
    .from("household_members")
    .select("role, household:households(id, name, period_start_day)")
    .eq("user_id", user.id)
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

  // 所属グループ全員のメンバーを取得する（RLS により自分の所属グループ分のみ返る）。
  const groupIds = groups.map((m) => m.household!.id);
  const { data: memberRows } = groupIds.length
    ? await supabase
        .from("household_members")
        .select("household_id, user_id, role, joined_at, display_name")
        .in("household_id", groupIds)
        .order("joined_at", { ascending: true })
    : { data: [] };
  const allMembers = memberRows ?? [];

  // 表示名はグループ毎の名前（household_members.display_name）を優先し、
  // 未設定ならグローバル名（profiles.display_name）にフォールバックする。
  const memberUserIds = [...new Set(allMembers.map((m) => m.user_id))];
  const { data: profileRows } = memberUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberUserIds)
    : { data: [] };
  const nameById = new Map(
    (profileRows ?? []).map((p) => [p.id, p.display_name]),
  );

  const membersOf = (householdId: string): MemberListItem[] =>
    allMembers
      .filter((m) => m.household_id === householdId)
      .map((m) => ({
        user_id: m.user_id,
        display_name:
          m.display_name ?? nameById.get(m.user_id) ?? "不明なユーザー",
        groupDisplayName: m.display_name,
        role: m.role,
        joined_at: m.joined_at,
        isSelf: m.user_id === user.id,
      }));

  return (
    <div className="mx-auto w-full max-w-2xl animate-in space-y-6 p-4 duration-500 fade-in slide-in-from-bottom-2 sm:py-8 lg:max-w-5xl">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <ShalletLogo className="size-9 shrink-0 rounded-[10px] shadow-soft" />
          <span className="font-heading text-base font-bold tracking-wide">
            Shallet
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {activeId ? (
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeft className="size-4" aria-hidden />
              ダッシュボードへ
            </Link>
          ) : null}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" aria-hidden />
              ログアウト
            </Button>
          </form>
          <ThemeToggleButton />
        </div>
      </div>

      <PageHeader
        eyebrow="グループ"
        title="家計簿グループ"
        meta={`ログイン中: ${user?.email ?? ""}`}
      />

      {/*
        作成フォームはグループが増えても埋もれないよう、モバイルでは先頭、
        lg 以上では右レール（sticky でスクロール中も見える）に置く。
        フォームを DOM に常在させることで E2E のセレクタも変わらない。
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="lg:sticky lg:top-8 lg:order-2">
          <Surface variant="raised">
            <CardHeader>
              <CardTitle>新しいグループを作成</CardTitle>
              <CardDescription>
                作成者は自動的にオーナーになります。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateHouseholdForm action={createHousehold} />
            </CardContent>
          </Surface>
        </div>

        <div className="min-w-0 lg:order-1">
          {groups.length === 0 ? (
            <Surface variant="raised">
              <CardContent className="py-6 text-sm text-muted-foreground">
                まだ参加しているグループがありません。「新しいグループを作成」から始めましょう。
              </CardContent>
            </Surface>
          ) : (
            <ul className="space-y-4">
              {groups.map(({ role, household }) => {
                const group = household!;
                const isActive = group.id === activeId;
                const groupInvitations = invitations.filter(
                  (inv) => inv.household_id === group.id,
                );
                const members = membersOf(group.id);
                return (
                  <li key={group.id}>
                    <Surface
                      variant="raised"
                      data-testid="household-card"
                      className={
                        isActive
                          ? "outline-2 outline-offset-2 outline-primary"
                          : ""
                      }
                    >
                      <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="break-all">{group.name}</span>
                            {role === "owner" ? (
                              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs whitespace-nowrap text-secondary-foreground">
                                オーナー
                              </span>
                            ) : null}
                          </CardTitle>
                          {isActive ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-primary"
                              data-testid="active-badge"
                            >
                              <Check className="size-4" aria-hidden />
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
                      {/*
                        メンバー変更・招待・設定は頻度が低く、一覧の見通しを
                        優先して既定では折り畳む（GroupDisclosure）。
                      */}
                      <CardContent>
                        <GroupDisclosure
                          label={`管理（メンバー${members.length}人）`}
                        >
                          <div>
                            <p className="mb-2 text-sm font-medium">メンバー</p>
                            <MemberList
                              householdId={group.id}
                              members={members}
                              viewerIsOwner={role === "owner"}
                              removeAction={removeMember}
                              leaveAction={leaveHousehold}
                              transferAction={transferOwnership}
                              updateNameAction={updateGroupDisplayName}
                            />
                          </div>
                          {role === "owner" ? (
                            <>
                              <div>
                                <p className="mb-2 text-sm font-medium">
                                  月の区切り
                                </p>
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
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                  >
                                    保存
                                  </Button>
                                </form>
                              </div>
                              <div>
                                <p className="mb-3 text-sm font-medium">
                                  メンバーを招待
                                </p>
                                <InvitationManager
                                  householdId={group.id}
                                  invitations={groupInvitations}
                                  createAction={createInvitation}
                                  updateAction={updateInvitation}
                                  revokeAction={revokeInvitation}
                                />
                              </div>
                              <div className="border-t border-border pt-4">
                                <p className="mb-1 text-sm font-medium text-destructive">
                                  危険な操作
                                </p>
                                <p className="mb-3 text-xs text-muted-foreground">
                                  グループを削除すると、取引・カテゴリ・メンバーがすべて失われ元に戻せません。
                                </p>
                                <DeleteHouseholdDialog
                                  householdId={group.id}
                                  householdName={group.name}
                                  memberCount={members.length}
                                  deleteAction={deleteHousehold}
                                />
                              </div>
                            </>
                          ) : null}
                        </GroupDisclosure>
                      </CardContent>
                    </Surface>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="text-center">
        <Link href="/dashboard" className={buttonVariants({ variant: "link" })}>
          ダッシュボードへ
        </Link>
      </div>
    </div>
  );
}
