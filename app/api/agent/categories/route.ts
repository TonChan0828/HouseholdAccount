import { agentRequest, uuid } from "@/lib/agent/http";

export function GET(request: Request) {
  return agentRequest(request, "categories", () => ({
    groupId: uuid.parse(new URL(request.url).searchParams.get("group")),
  }));
}
