import { agentRequest, changes, readJson, uuid } from "@/lib/agent/http";

type Context = RouteContext<"/api/agent/transactions/[id]">;

export function PATCH(request: Request, context: Context) {
  return agentRequest(request, "update", async () => ({
    id: uuid.parse((await context.params).id),
    changes: changes.parse(await readJson(request)),
  }));
}

export function DELETE(request: Request, context: Context) {
  return agentRequest(request, "delete", async () => ({
    id: uuid.parse((await context.params).id),
  }));
}
