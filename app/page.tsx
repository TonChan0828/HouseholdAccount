import type { Metadata } from "next";
import { Suspense } from "react";

import { FeatureBento } from "@/components/features/landing/feature-bento";
import { FinalCta } from "@/components/features/landing/final-cta";
import { Hero } from "@/components/features/landing/hero";
import { LandingFooter } from "@/components/features/landing/landing-footer";
import { LandingHeader } from "@/components/features/landing/landing-header";
import { LoggedOutToast } from "@/components/features/landing/logged-out-toast";
import { Steps } from "@/components/features/landing/steps";

export const metadata: Metadata = {
  title: "Shallet｜家計を、みんなで一緒に。",
  description:
    "家族やパートナーとグループで収支を共有し、月次で自動集計。誰が何に使ったか一目で分かる家計簿アプリ。",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={null}>
        <LoggedOutToast />
      </Suspense>
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <FeatureBento />
        <Steps />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
