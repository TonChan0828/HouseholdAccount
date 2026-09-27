import {
  Banknote,
  BriefcaseBusiness,
  CarFront,
  CircleHelp,
  Gift,
  HeartPulse,
  House,
  PawPrint,
  Plane,
  ShoppingBasket,
  Smartphone,
  Utensils,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  icon: string | null;
  color: string | null;
  className?: string;
};

/** 選択済みならカテゴリ記号、未設定または未知値なら従来の色ドットを表示する。 */
export function CategoryIconMark({ icon, color, className }: Props) {
  const iconClassName = cn("size-3.5 shrink-0", className);
  const style = { color: color ?? "#999" };
  switch (icon) {
    case "utensils":
      return <Utensils aria-hidden className={iconClassName} style={style} />;
    case "shopping-basket":
      return <ShoppingBasket aria-hidden className={iconClassName} style={style} />;
    case "house":
      return <House aria-hidden className={iconClassName} style={style} />;
    case "car":
      return <CarFront aria-hidden className={iconClassName} style={style} />;
    case "heart-pulse":
      return <HeartPulse aria-hidden className={iconClassName} style={style} />;
    case "paw-print":
      return <PawPrint aria-hidden className={iconClassName} style={style} />;
    case "banknote":
      return <Banknote aria-hidden className={iconClassName} style={style} />;
    case "briefcase":
      return <BriefcaseBusiness aria-hidden className={iconClassName} style={style} />;
    case "smartphone":
      return <Smartphone aria-hidden className={iconClassName} style={style} />;
    case "plane":
      return <Plane aria-hidden className={iconClassName} style={style} />;
    case "gift":
      return <Gift aria-hidden className={iconClassName} style={style} />;
    case "other":
      return <CircleHelp aria-hidden className={iconClassName} style={style} />;
    default:
      return (
        <span
          aria-hidden
          className={cn("inline-block size-2 shrink-0 rounded-full", className)}
          style={{ backgroundColor: color ?? "#999" }}
        />
      );
  }
}
