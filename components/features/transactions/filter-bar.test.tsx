import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterBar } from "./filter-bar";

const state = vi.hoisted(() => ({
  replaceCalls: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (url: string) => {
      state.replaceCalls.push(url);
    },
  }),
}));

const categories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "食費", color: "#f00" },
  { id: "22222222-2222-4222-8222-222222222222", name: "給料", color: null },
];

const members = [
  { user_id: "33333333-3333-4333-8333-333333333333", display_name: "太郎" },
  { user_id: "44444444-4444-4444-8444-444444444444", display_name: "花子" },
];

function lastUrlParams() {
  const url = state.replaceCalls.at(-1);
  expect(url).toBeDefined();
  return new URLSearchParams(url!.split("?")[1] ?? "");
}

beforeEach(() => {
  state.replaceCalls = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FilterBar", () => {
  it("種別ピルをクリックすると type クエリで URL を更新する", () => {
    render(
      <FilterBar filter={{}} categories={categories} members={members} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "支出" }));

    expect(lastUrlParams().get("type")).toBe("expense");
  });

  it("currentRef を保持したまま URL を更新する", () => {
    render(
      <FilterBar
        filter={{}}
        currentRef="2026-07-01"
        categories={categories}
        members={members}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "収入" }));

    const params = lastUrlParams();
    expect(params.get("ref")).toBe("2026-07-01");
    expect(params.get("type")).toBe("income");
  });

  it("「すべて」をクリックすると type を解除する（他の条件は保持）", () => {
    render(
      <FilterBar
        filter={{ type: "expense", memoQuery: "コンビニ" }}
        categories={categories}
        members={members}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "すべて" }));

    const params = lastUrlParams();
    expect(params.has("type")).toBe(false);
    expect(params.get("q")).toBe("コンビニ");
  });

  it("カテゴリ選択で category クエリを更新する", () => {
    render(
      <FilterBar filter={{}} categories={categories} members={members} />,
    );

    fireEvent.change(screen.getByLabelText("カテゴリ"), {
      target: { value: categories[0].id },
    });

    expect(lastUrlParams().get("category")).toBe(categories[0].id);
  });

  it("メンバー選択で member クエリを更新する", () => {
    render(
      <FilterBar filter={{}} categories={categories} members={members} />,
    );

    fireEvent.change(screen.getByLabelText("メンバー（名義人）"), {
      target: { value: members[1].user_id },
    });

    expect(lastUrlParams().get("member")).toBe(members[1].user_id);
  });

  it("メンバーが1人以下ならメンバーセレクトを表示しない", () => {
    render(
      <FilterBar
        filter={{}}
        categories={categories}
        members={[members[0]]}
      />,
    );

    expect(screen.queryByLabelText("メンバー（名義人）")).toBeNull();
  });

  it("メモ検索は 300ms デバウンスして q クエリを更新する", () => {
    vi.useFakeTimers();
    render(
      <FilterBar filter={{}} categories={categories} members={members} />,
    );

    fireEvent.change(screen.getByLabelText("メモを検索"), {
      target: { value: "コンビニ" },
    });

    expect(state.replaceCalls).toEqual([]);
    vi.advanceTimersByTime(300);
    expect(lastUrlParams().get("q")).toBe("コンビニ");
  });

  it("金額の下限・上限もデバウンスして min / max クエリを更新する", () => {
    vi.useFakeTimers();
    render(
      <FilterBar filter={{}} categories={categories} members={members} />,
    );

    fireEvent.change(screen.getByLabelText("金額(下限)"), {
      target: { value: "1000" },
    });
    vi.advanceTimersByTime(300);

    expect(lastUrlParams().get("min")).toBe("1000");
  });

  it("フィルタ有効時のみクリアボタンを表示し、クリックで ref だけ残して解除する", () => {
    const { rerender } = render(
      <FilterBar filter={{}} categories={categories} members={members} />,
    );
    expect(screen.queryByRole("button", { name: "クリア" })).toBeNull();

    rerender(
      <FilterBar
        filter={{ type: "expense" }}
        currentRef="2026-07-01"
        categories={categories}
        members={members}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));

    const url = state.replaceCalls.at(-1);
    expect(url).toBe("/transactions?ref=2026-07-01");
  });
});

it("カレンダーの条件変更とクリアはカレンダー内で行う", () => {
  render(<FilterBar filter={{ type: "expense", memoQuery: "ランチ" }} currentRef="2026-10-01" categories={categories} members={members} basePath="/calendar" />);
  fireEvent.click(screen.getByRole("button", { name: "収入" }));
  expect(state.replaceCalls.at(-1)).toContain("/calendar?");
  expect(lastUrlParams().get("q")).toBe("ランチ");
  fireEvent.click(screen.getByRole("button", { name: /クリア/ }));
  expect(state.replaceCalls.at(-1)).toBe("/calendar?ref=2026-10-01");
});
