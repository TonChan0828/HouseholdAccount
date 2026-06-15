import Link from "next/link";

import { ThemeToggleButton } from "@/components/features/layout/theme-toggle";
import { ShalletMark } from "@/components/shallet-mark";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggleButton />
      </div>
      <div className="flex animate-in flex-col items-center gap-3 duration-700 fade-in slide-in-from-bottom-3">
        <Link
          href="/"
          className="flex size-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lifted"
        >
          <ShalletMark className="size-8" />
        </Link>
        <div className="text-center">
          <p className="font-heading text-xl font-bold tracking-wide">
            Shallet
          </p>
          <p className="text-sm text-muted-foreground">
            家族と一緒に、楽しく家計を見える化
          </p>
        </div>
      </div>
      <div className="w-full max-w-sm animate-in duration-700 fade-in slide-in-from-bottom-2">
        {children}
      </div>
    </div>
  );
}
