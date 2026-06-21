import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Variant = "raised" | "sunken" | "flat";

type Props = React.ComponentProps<typeof Card> & { variant?: Variant };

const VARIANTS: Record<Variant, string> = {
  raised: "shadow-[var(--shadow-pillow)] ring-0",
  sunken: "bg-surface-sunken shadow-[var(--shadow-inset)] ring-1 ring-foreground/5",
  flat: "shadow-none ring-1 ring-foreground/10",
};

/** shadcn Card にマテリアルな質感（pillow/inset）を与えるラッパー。 */
export function Surface({ variant = "raised", className, ...props }: Props) {
  return <Card className={cn(VARIANTS[variant], className)} {...props} />;
}
