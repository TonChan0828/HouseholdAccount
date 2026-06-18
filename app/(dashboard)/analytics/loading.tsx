import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** 分析ページのデータ取得中に表示するスケルトン。 */
export default function AnalyticsLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="h-8 w-24 animate-pulse rounded-md bg-muted/60" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="shadow-soft ring-0">
            <CardHeader>
              <div className="h-5 w-36 animate-pulse rounded-md bg-muted/60" />
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full animate-pulse rounded-md bg-muted/60" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
