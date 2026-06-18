import { Card, CardContent } from "@/components/ui/card";

/** 収支一覧のデータ取得中に表示するスケルトン。 */
export default function TransactionsLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted/60" />
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="shadow-soft ring-0">
            <CardContent className="flex items-center justify-between py-3">
              <div className="h-5 w-32 animate-pulse rounded-md bg-muted/60" />
              <div className="h-5 w-20 animate-pulse rounded-md bg-muted/60" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
