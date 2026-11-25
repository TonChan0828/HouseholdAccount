"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { undoTransactionDelete } from "@/app/(dashboard)/transactions/actions";

export function TransactionDeletionNotice({ receipt }: {
  receipt: { id: string; expiresAt: string };
}) {
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem("last-transaction-deletion") === receipt.id) return;
    sessionStorage.setItem("last-transaction-deletion", receipt.id);

    const remaining = Date.parse(receipt.expiresAt) - Date.now();
    if (remaining <= 0) {
      toast.success("収支を削除しました");
      return;
    }
    toast.success("収支を削除しました", {
      duration: remaining,
      action: {
        label: "元に戻す",
        async onClick() {
          try {
            if (await undoTransactionDelete(receipt.id)) {
              toast.success("収支を元に戻しました");
              router.refresh();
              return;
            }
          } catch {
            // The server checks ownership and expiry before restoring.
          }
          toast.error("収支を元に戻せませんでした。");
        },
      },
    });
  }, [router, receipt]);

  return null;
}
