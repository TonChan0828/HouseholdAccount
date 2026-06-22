import { CardContent } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";

/** メンバー別アクティビティのデータ取得中に表示するスケルトン。 */
export default function MembersLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="flex items-center justify-between">
        <div className="h-9 w-56 animate-pulse rounded-md bg-muted/60" />
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Surface key={i} variant="raised">
            <CardContent className="space-y-2 py-4">
              <div className="h-5 w-40 animate-pulse rounded-md bg-muted/60" />
              <div className="h-4 w-full animate-pulse rounded-md bg-muted/60" />
            </CardContent>
          </Surface>
        ))}
      </div>
    </main>
  );
}
