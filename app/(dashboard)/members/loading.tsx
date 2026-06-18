import { Card, CardContent } from "@/components/ui/card";

/** メンバー別アクティビティのデータ取得中に表示するスケルトン。 */
export default function MembersLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:py-8">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted/60" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="shadow-soft ring-0">
            <CardContent className="space-y-2 py-4">
              <div className="h-5 w-40 animate-pulse rounded-md bg-muted/60" />
              <div className="h-4 w-full animate-pulse rounded-md bg-muted/60" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
