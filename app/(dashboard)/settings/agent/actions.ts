"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireDashboardContext } from "@/lib/household";

const path = "/settings/agent";
const uuid = z.string().uuid();
const labelSchema = z.string().trim().min(1).max(60);

export type AgentSettingsState = { error: string } | { message: string; token?: string } | undefined;

export async function createAgentToken(_state: AgentSettingsState, formData: FormData): Promise<AgentSettingsState> {
  const label = labelSchema.safeParse(formData.get("label"));
  if (!label.success) return { error: "名前を1〜60文字で入力してください。" };

  const { supabase } = await requireDashboardContext();
  const { data, error } = await supabase.rpc("create_agent_token", { _label: label.data });
  if (error || !data) return { error: "トークンを発行できませんでした。" };
  revalidatePath(path);
  return { message: "トークンを発行しました。この画面を離れる前にコピーしてください。", token: data };
}

export async function revokeAgentToken(_state: AgentSettingsState, formData: FormData): Promise<AgentSettingsState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "トークンを指定してください。" };

  const { supabase } = await requireDashboardContext();
  const { error } = await supabase.rpc("revoke_agent_token", { _id: id.data });
  if (error) return { error: "トークンを失効できませんでした。" };
  revalidatePath(path);
  return { message: "トークンを失効しました。" };
}

const routingSchema = z.object({
  personal: uuid,
  home: uuid,
  transfer: uuid,
  mappings: z.string().max(8_192),
}).refine(({ personal, home, transfer }) => new Set([personal, home, transfer]).size === 3);

export async function saveAgentRouting(_state: AgentSettingsState, formData: FormData): Promise<AgentSettingsState> {
  const parsed = routingSchema.safeParse({
    personal: formData.get("personal"),
    home: formData.get("home"),
    transfer: formData.get("transfer"),
    mappings: formData.get("mappings"),
  });
  if (!parsed.success) return { error: "異なるグループを3つ選んでください。" };

  const mappings: Record<string, string> = {};
  for (const line of parsed.data.mappings.split("\n")) {
    if (!line.trim()) continue;
    const pair = z.tuple([uuid, uuid]).safeParse(line.split("=").map((value) => value.trim()));
    if (!pair.success || Object.hasOwn(mappings, pair.data[0])) {
      return { error: "カテゴリの対応は元のIDと反映先のIDを = で結び、1行に1組入力してください。" };
    }
    mappings[pair.data[0]] = pair.data[1];
  }

  const { supabase } = await requireDashboardContext();
  const { error } = await supabase.rpc("save_agent_routing", {
    _personal_id: parsed.data.personal,
    _home_id: parsed.data.home,
    _transfer_id: parsed.data.transfer,
    _category_map: mappings,
  });
  if (error) return { error: "所属グループとカテゴリの対応を確認してください。" };
  revalidatePath(path);
  return { message: "振り分け設定を保存しました。" };
}
