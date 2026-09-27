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

export const CATEGORY_ICON_OPTIONS = [
  { value: "utensils", label: "食事", Icon: Utensils },
  { value: "shopping-basket", label: "買い物", Icon: ShoppingBasket },
  { value: "house", label: "住まい", Icon: House },
  { value: "car", label: "交通", Icon: CarFront },
  { value: "heart-pulse", label: "健康", Icon: HeartPulse },
  { value: "paw-print", label: "ペット", Icon: PawPrint },
  { value: "banknote", label: "お金", Icon: Banknote },
  { value: "briefcase", label: "仕事", Icon: BriefcaseBusiness },
  { value: "smartphone", label: "通信", Icon: Smartphone },
  { value: "plane", label: "旅行", Icon: Plane },
  { value: "gift", label: "趣味・贈り物", Icon: Gift },
  { value: "other", label: "その他", Icon: CircleHelp },
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number]["value"];
