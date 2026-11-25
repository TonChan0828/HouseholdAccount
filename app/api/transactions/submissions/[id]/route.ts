import { z } from "zod";

import { getCurrentUser } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { submissionReceipt } from "@/lib/transactions/submission-receipt";

const headers = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/transactions/submissions/[id]">,
) {
  if (!(await getCurrentUser())) return new Response(null, { status: 401, headers });
  const requestId = z.string().uuid().safeParse((await params).id);
  if (!requestId.success) return new Response(null, { status: 404, headers });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_ui_transaction_receipt", { _request_id: requestId.data });
  if (error) return new Response(null, { status: 503, headers });
  if (!data) return new Response(null, { status: 404, headers });

  const receipt = submissionReceipt.safeParse(data);
  if (!receipt.success) return new Response(null, { status: 503, headers });
  return Response.json(receipt.data, { headers });
}
