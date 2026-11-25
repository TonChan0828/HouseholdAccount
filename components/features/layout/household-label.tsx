import { cn } from "@/lib/utils";

const accents = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

export function HouseholdLabel({
  household,
}: {
  household: { id: string; name: string };
}) {
  let color = 0;
  for (const char of household.id) {
    color = (color * 31 + char.charCodeAt(0)) % accents.length;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", accents[color])} />
      <span className="truncate" title={household.name}>{household.name}</span>
    </span>
  );
}
