import {
  ChartPie,
  MoonStar,
  ReceiptJapaneseYen,
  Tags,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const FEATURES: Feature[] = [
  {
    title: "グループ共有",
    description: "家族やパートナーと家計簿を共有。招待リンクですぐ参加。",
    icon: Users,
  },
  {
    title: "収支記録",
    description: "日付・金額・カテゴリ・メモを数タップで。登録者も自動記録。",
    icon: ReceiptJapaneseYen,
  },
  {
    title: "月次分析",
    description: "月別推移グラフとカテゴリ別円グラフで使いみちを可視化。",
    icon: ChartPie,
  },
  {
    title: "メンバー別アクティビティ",
    description: "誰がいつ何に使ったかをメンバーごとに集計。",
    icon: UsersRound,
  },
  {
    title: "カテゴリ管理",
    description: "デフォルト＋グループ共有のカスタムカテゴリを自由に管理。",
    icon: Tags,
  },
  {
    title: "ダークモード",
    description: "ライト／ダーク／システムに対応。目にやさしい配色。",
    icon: MoonStar,
  },
];

/** 機能紹介のグリッド。PC はベント型、スマホは1カラム。 */
export function FeatureBento() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-5xl px-4 py-16 md:py-20"
    >
      <h2 className="text-center font-heading text-3xl font-bold text-foreground">
        家計の「見える化」に必要なものを
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
              {title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
