import { agentRequest } from "@/lib/agent/http";

export function GET(request: Request) {
  return agentRequest(request, "groups");
}
