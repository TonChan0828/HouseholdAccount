import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** ダッシュボードのデータ取得中に表示するスケルトン。 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted/60" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
      <Card className="shadow-soft ring-0">
        <CardHeader>
          <div className="h-5 w-28 animate-pulse rounded-md bg-muted/60" />
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full animate-pulse rounded-md bg-muted/60" />
        </CardContent>
      </Card>
      <div className="h-40 w-full animate-pulse rounded-xl bg-muted/60" />
    </main>
  );
}
