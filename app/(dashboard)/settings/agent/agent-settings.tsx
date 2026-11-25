"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createAgentToken, revokeAgentToken, saveAgentRouting, type AgentSettingsState } from "./actions";

export type Token = { id: string; label: string; created_at: string };
export type Routing = { personalId?: string; homeId?: string; transferId?: string; categoryMap?: Record<string, string> };

function Result({ state }: { state: AgentSettingsState }) {
  if (!state) return null;
  if ("error" in state) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  return <p role="status" className="text-sm">{state.message}</p>;
}

export function TokenSettings({ tokens }: { tokens: Token[] }) {
  const [issued, issue, issuing] = useActionState(createAgentToken, undefined);
  const [revoked, revoke, revoking] = useActionState(revokeAgentToken, undefined);

  return (
    <div className="space-y-4">
      <form action={issue} className="space-y-2">
        <Label htmlFor="agent-token-label">トークンの名前</Label>
        <div className="flex gap-2">
          <Input id="agent-token-label" name="label" placeholder="例：レシート登録" required maxLength={60} />
          <Button type="submit" disabled={issuing}>発行</Button>
        </div>
        <Result state={issued} />
        {issued && "token" in issued && issued.token ? (
          <Input
            aria-label="発行したトークン"
            readOnly
            value={issued.token}
            className="font-mono"
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : null}
      </form>
      {tokens.length > 0 ? (
        <ul className="divide-y">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 break-words text-sm">{token.label}</span>
              <form action={revoke}>
                <input type="hidden" name="id" value={token.id} />
                <Button size="sm" variant="outline" type="submit" disabled={revoking} aria-label={`${token.label}を失効`}>
                  失効
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">有効なトークンはありません。</p>}
      <Result state={revoked} />
    </div>
  );
}

export function RoutingSettings({ groups, routing }: {
  groups: { id: string; name: string }[];
  routing: Routing;
}) {
  const [state, save, pending] = useActionState(saveAgentRouting, undefined);
  if (groups.length < 3) {
    return <p className="text-sm text-muted-foreground">振り分けには所属グループが3つ必要です。</p>;
  }

  const fields = [
    { name: "personal", label: "私の家計簿", selected: routing.personalId },
    { name: "home", label: "家の家計簿", selected: routing.homeId },
    { name: "transfer", label: "家計振込分", selected: routing.transferId },
  ];

  return (
    <form action={save} className="space-y-4">
      {fields.map(({ name, label, selected }) => (
        <div className="space-y-2" key={name}>
          <Label htmlFor={name}>{label}</Label>
          <select id={name} name={name} required defaultValue={selected ?? ""}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
            <option value="">グループを選択</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor="agent-category-mappings">カテゴリの対応</Label>
        <textarea
          id="agent-category-mappings"
          name="mappings"
          rows={3}
          maxLength={8192}
          defaultValue={Object.entries(routing.categoryMap ?? {}).map(([source, destination]) => `${source}=${destination}`).join("\n")}
          className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          名前が異なるカテゴリは、元のカテゴリIDと反映先のカテゴリIDを = で結び、1行に1組入力してください。
        </p>
      </div>
      <Button type="submit" disabled={pending}>設定を保存</Button>
      <Result state={state} />
    </form>
  );
}
