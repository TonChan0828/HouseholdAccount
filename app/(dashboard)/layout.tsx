import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware でも保護しているが、二重防御として確認する。
  if (!user) {
    redirect("/login");
  }

  return <div className="flex flex-1 flex-col">{children}</div>;
}
