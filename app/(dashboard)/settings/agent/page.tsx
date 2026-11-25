import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { getUserHouseholds, requireDashboardContext } from "@/lib/household";
import { unwrapData } from "@/lib/queries/result";

import { RoutingSettings, TokenSettings } from "./agent-settings";

const routingSchema = z.object({
  personalId: z.string().uuid(),
  homeId: z.string().uuid(),
  transferId: z.string().uuid(),
  categoryMap: z.record(z.string(), z.string()),
});

export default async function AgentSettingsPage() {
  const { supabase } = await requireDashboardContext();
  const [tokenResult, routingResult, groups] = await Promise.all([
    supabase.rpc("list_agent_tokens"),
    supabase.rpc("get_agent_routing"),
    getUserHouseholds(),
  ]);
  const tokens = unwrapData(tokenResult, "listAgentTokens") ?? [];
  const routing = unwrapData(routingResult, "getAgentRouting");

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 p-4 sm:py-8">
      <PageHeader title="エージェント API" />
      <section>
        <SectionHeading>API トークン</SectionHeading>
        <Surface variant="raised">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              トークンを持つエージェントは、あなたが所属するグループの収支を閲覧・登録できます。不要になったトークンは失効してください。
            </p>
            <TokenSettings tokens={tokens} />
          </CardContent>
        </Surface>
      </section>
      <section>
        <SectionHeading>API 登録時の振り分け</SectionHeading>
        <Surface variant="raised">
          <CardContent className="pt-6">
            <RoutingSettings groups={groups} routing={routing ? routingSchema.parse(routing) : {}} />
          </CardContent>
        </Surface>
      </section>
      <Link href="/settings" className={buttonVariants({ variant: "link" })}>設定へ戻る</Link>
    </main>
  );
}
