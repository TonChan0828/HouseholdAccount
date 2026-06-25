"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import type { InvitationActionState } from "@/app/households/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HouseholdInvitation } from "@/types";

const SHARE_TITLE = "Shallet 家計簿グループへの招待";
const SHARE_TEXT =
  "Shallet の家計簿グループに招待します。下のリンクから参加してください。";

function lineShareUrl(url: string): string {
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
}

// Web Share API は対応端末でのみ表示する（SSR では false、クライアントで判定）
const subscribeNoop = () => () => {};
function useCanNativeShare(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function",
    () => false,
  );
}

type CreateAction = (
  state: InvitationActionState,
  formData: FormData,
) => Promise<InvitationActionState>;
type SimpleAction = (formData: FormData) => Promise<void>;

type Props = {
  householdId: string;
  invitations: HouseholdInvitation[];
  createAction: CreateAction;
  updateAction: SimpleAction;
  revokeAction: SimpleAction;
};

function inviteUrl(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

export function InvitationManager({
  householdId,
  invitations,
  createAction,
  updateAction,
  revokeAction,
}: Props) {
  const [state, formAction, pending] = useActionState<
    InvitationActionState,
    FormData
  >(createAction, undefined);

  const newToken = state && "token" in state ? state.token : null;
  const error = state && "error" in state ? state.error : null;

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="household_id" value={householdId} />
        <div className="space-y-2">
          <Label htmlFor={`max-uses-${householdId}`}>参加できる人数</Label>
          <Input
            id={`max-uses-${householdId}`}
            name="max_uses"
            type="number"
            min={1}
            max={50}
            defaultValue={1}
            className="w-24"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "発行中..." : "招待リンクを発行"}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {newToken ? (
        <CopyableLink url={inviteUrl(newToken)} />
      ) : null}

      {invitations.length > 0 ? (
        <ul className="space-y-3">
          {invitations.map((inv) => {
            const remaining = Math.max(inv.max_uses - inv.uses_count, 0);
            return (
              <li
                key={inv.id}
                className="rounded-md border p-3 text-sm"
                data-testid="invitation-item"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    残り {remaining} / 上限 {inv.max_uses} 人
                  </span>
                  <form action={revokeAction}>
                    <input type="hidden" name="invitation_id" value={inv.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      失効
                    </Button>
                  </form>
                </div>
                <CopyableLink url={inviteUrl(inv.token)} />
                <form
                  action={updateAction}
                  className="mt-2 flex items-end gap-2"
                >
                  <input type="hidden" name="invitation_id" value={inv.id} />
                  <div className="space-y-1">
                    <Label htmlFor={`update-${inv.id}`} className="text-xs">
                      人数を変更
                    </Label>
                    <Input
                      id={`update-${inv.id}`}
                      name="max_uses"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={inv.max_uses}
                      className="w-20"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    更新
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = useCanNativeShare();

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input readOnly value={url} className="min-w-0 flex-1 text-xs" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="コピー"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // クリップボード API が使えない環境では何もしない
          }
        }}
      >
        {copied ? "コピー済" : "コピー"}
      </Button>
      <a
        href={lineShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LINEで共有"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        LINE
      </a>
      {canNativeShare ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="共有"
          onClick={async () => {
            try {
              await navigator.share({
                title: SHARE_TITLE,
                text: SHARE_TEXT,
                url,
              });
            } catch {
              // ユーザーがキャンセル / 非対応環境では何もしない
            }
          }}
        >
          共有
        </Button>
      ) : null}
    </div>
  );
}
