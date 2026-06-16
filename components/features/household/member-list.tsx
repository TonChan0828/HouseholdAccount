"use client";

import { useActionState, useState } from "react";

import type { LeaveHouseholdActionState } from "@/app/households/actions";
import { Button } from "@/components/ui/button";
import type { MemberRole } from "@/types";

/** メンバー一覧の表示・操作に必要な1メンバー分のデータ。 */
export type MemberListItem = {
  user_id: string;
  display_name: string;
  role: MemberRole;
  joined_at: string;
  /** 閲覧者自身の行か。 */
  isSelf: boolean;
};

type SimpleAction = (formData: FormData) => Promise<void>;
type LeaveAction = (
  state: LeaveHouseholdActionState,
  formData: FormData,
) => Promise<LeaveHouseholdActionState>;

type Props = {
  householdId: string;
  members: MemberListItem[];
  /** 閲覧者がこのグループの owner か（除外・委譲の表示制御）。 */
  viewerIsOwner: boolean;
  removeAction: SimpleAction;
  leaveAction: LeaveAction;
  transferAction: SimpleAction;
};

function formatJoinedAt(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} 参加`;
}

export function MemberList({
  householdId,
  members,
  viewerIsOwner,
  removeAction,
  leaveAction,
  transferAction,
}: Props) {
  return (
    <ul className="space-y-2" data-testid="member-list">
      {members.map((m) => (
        <li
          key={m.user_id}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border p-3 text-sm"
          data-testid="member-item"
        >
          <span className="font-medium break-all">{m.display_name}</span>
          {m.role === "owner" ? (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs whitespace-nowrap text-secondary-foreground">
              オーナー
            </span>
          ) : null}
          {m.isSelf ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
              あなた
            </span>
          ) : null}
          <span className="ml-1 text-xs text-muted-foreground">
            {formatJoinedAt(m.joined_at)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* owner が他メンバーを委譲・除外 */}
            {viewerIsOwner && !m.isSelf ? (
              <>
                <ConfirmAction
                  action={transferAction}
                  hidden={{ household_id: householdId, user_id: m.user_id }}
                  trigger="オーナーを委譲"
                  triggerVariant="outline"
                  confirmLabel="委譲する"
                  confirmVariant="default"
                  message={`${m.display_name} にオーナーを委譲しますか？（あなたはメンバーになります）`}
                />
                <ConfirmAction
                  action={removeAction}
                  hidden={{ household_id: householdId, user_id: m.user_id }}
                  trigger="除外"
                  triggerVariant="ghost"
                  confirmLabel="除外する"
                  confirmVariant="destructive"
                  message={`${m.display_name} をグループから除外しますか？`}
                />
              </>
            ) : null}

            {/* 自分の行: member は脱退、owner は委譲を促す注記 */}
            {m.isSelf && m.role !== "owner" ? (
              <LeaveButton householdId={householdId} leaveAction={leaveAction} />
            ) : null}
            {m.isSelf && m.role === "owner" && members.length > 1 ? (
              <span className="text-xs text-muted-foreground">
                委譲してから脱退できます
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** クリック→確認ステップ→submit の2段階で破壊的操作を実行する。 */
function ConfirmAction({
  action,
  hidden,
  trigger,
  triggerVariant,
  confirmLabel,
  confirmVariant,
  message,
}: {
  action: SimpleAction;
  hidden: Record<string, string>;
  trigger: string;
  triggerVariant: "outline" | "ghost";
  confirmLabel: string;
  confirmVariant: "default" | "destructive";
  message: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        onClick={() => setConfirming(true)}
      >
        {trigger}
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <span className="text-xs text-muted-foreground">{message}</span>
      <Button type="submit" variant={confirmVariant} size="sm">
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
      >
        キャンセル
      </Button>
    </form>
  );
}

/** 自分でグループを脱退する（確認ステップつき）。owner には表示しない。 */
function LeaveButton({
  householdId,
  leaveAction,
}: {
  householdId: string;
  leaveAction: LeaveAction;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<
    LeaveHouseholdActionState,
    FormData
  >(leaveAction, undefined);
  const error = state && "error" in state ? state.error : null;

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        脱退
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction} className="flex items-center gap-1">
        <input type="hidden" name="household_id" value={householdId} />
        <span className="text-xs text-muted-foreground">
          このグループを脱退しますか？
        </span>
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={pending}
        >
          脱退する
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          キャンセル
        </Button>
      </form>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
