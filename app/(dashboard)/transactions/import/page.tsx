import Link from "next/link";

import {
  confirmImport,
  parseImportFile,
} from "@/app/(dashboard)/transactions/import/actions";
import { ImportForm } from "@/components/features/transactions/import-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireDashboardContext } from "@/lib/household";
import { getHouseholdMemberNames } from "@/lib/queries/members";

export default async function ImportTransactionsPage() {
  const { householdId, user } = await requireDashboardContext();
  const members = (await getHouseholdMemberNames(householdId)).filter((member) => member.user_id !== user.id);

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>Excel から取り込み</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm parseAction={parseImportFile} confirmAction={confirmImport} members={members} />
        </CardContent>
      </Card>
      <div className="text-center">
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "link" })}
        >
          一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
