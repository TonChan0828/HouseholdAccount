import type { Instrumentation } from "next";

import { logServerError } from "@/lib/observability";

/** Next.js が捕捉した未処理のサーバー障害を、外部サービス不要の構造化ログへ送る。 */
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  logServerError("next.request.error", error, {
    method: request.method,
    path: request.path.split("?", 1)[0],
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
