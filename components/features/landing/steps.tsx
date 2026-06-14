type Step = {
  no: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    no: "1",
    title: "アカウント登録",
    description: "メールアドレスとパスワードで30秒で登録。",
  },
  {
    no: "2",
    title: "グループを作成",
    description: "家計簿グループを作って、家族やパートナーを招待。",
  },
  {
    no: "3",
    title: "記録をはじめる",
    description: "収支を記録すると、ダッシュボードに自動で集計。",
  },
];

/** 使い方の3ステップ。 */
export function Steps() {
  return (
    <section id="steps" className="mx-auto w-full max-w-5xl px-4 py-16 md:py-20">
      <h2 className="text-center font-heading text-3xl font-bold text-foreground">
        はじめ方はかんたん3ステップ
      </h2>
      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map(({ no, title, description }) => (
          <li
            key={no}
            className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground">
              {no}
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
              {title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
