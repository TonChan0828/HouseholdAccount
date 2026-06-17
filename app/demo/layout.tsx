import { DemoBanner } from "@/components/features/demo/demo-banner";
import { DemoHeader } from "@/components/features/demo/demo-header";
import { DemoProvider } from "@/components/features/demo/demo-provider";
import { DemoTabBar } from "@/components/features/demo/demo-tab-bar";

export default function DemoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DemoProvider>
      <div className="flex flex-1 flex-col">
        <DemoBanner />
        <DemoHeader />
        <div className="flex flex-1 flex-col pb-24 lg:pb-0">{children}</div>
        <DemoTabBar />
      </div>
    </DemoProvider>
  );
}
