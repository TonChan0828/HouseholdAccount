import type { MemberInfo } from "@/lib/members";

type Props = {
  members: MemberInfo[];
  selectedMemberId: string | null;
  year: number;
};

/** 年間分析のメンバー絞り込み。GETフォームなので共有可能なURLになる。 */
export function YearlyMemberFilter({
  members,
  selectedMemberId,
  year,
}: Props) {
  return (
    <form
      action="/analytics"
      method="get"
      className="flex flex-wrap items-end gap-2"
      aria-label="年間分析の表示メンバー"
    >
      <input type="hidden" name="view" value="year" />
      <input type="hidden" name="year" value={year} />
      <div className="grid gap-1">
        <label htmlFor="yearly-member" className="text-xs text-muted-foreground">
          メンバー
        </label>
        <select
          id="yearly-member"
          name="member"
          defaultValue={selectedMemberId ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">全員</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
      >
        表示
      </button>
    </form>
  );
}
