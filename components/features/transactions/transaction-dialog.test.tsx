import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CategoryOption } from "@/lib/queries/categories";

import {
  EditTransactionButton,
  NewTransactionButton,
  TransactionDialogProvider,
  type DialogTransaction,
} from "./transaction-dialog";

const actions = vi.hoisted(() => ({
  create: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
  reflect: vi.fn(async () => undefined),
}));

vi.mock("@/app/(dashboard)/transactions/actions", () => ({
  createTransaction: actions.create,
  updateTransaction: actions.update,
  reflectTransaction: actions.reflect,
}));

const categories: CategoryOption[] = [
  { id: "c-1", name: "食費", color: "#ef4444", type: "expense" },
  { id: "c-2", name: "給与", color: "#10b981", type: "income" },
];

const TARO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HANAKO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const members = [
  { user_id: TARO, display_name: "太郎" },
  { user_id: HANAKO, display_name: "花子" },
];

const transaction: DialogTransaction = {
  id: "t-1",
  type: "expense",
  amount: 1200,
  date: "2026-06-13",
  category_id: "c-1",
  memo: "ランチ",
  created_by: TARO,
  on_behalf_of: null,
  is_shared: false,
};

function renderWithProvider(
  children: React.ReactNode,
  otherHouseholds: { id: string; name: string }[] = [],
  options: {
    members?: { user_id: string; display_name: string }[];
    currentUserId?: string;
  } = {},
) {
  return render(
    <TransactionDialogProvider
      categories={categories}
      otherHouseholds={otherHouseholds}
      members={options.members ?? []}
      currentUserId={options.currentUserId ?? TARO}
    >
      {children}
    </TransactionDialogProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TransactionDialogProvider", () => {
  it("初期状態ではダイアログを表示しない", () => {
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    expect(screen.queryByTestId("transaction-dialog")).not.toBeInTheDocument();
  });

  it("編集ボタンでダイアログが開き、既存の値がプリフィルされる", async () => {
    const user = userEvent.setup();
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(await screen.findByTestId("transaction-dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "収支を編集" })).toBeInTheDocument();
    expect(screen.getByLabelText("金額")).toHaveValue("1200");
    expect(screen.getByLabelText("日付")).toHaveValue("2026-06-13");
    expect(screen.getByLabelText("メモ")).toHaveValue("ランチ");
    expect(screen.getByRole("radio", { name: "食費" })).toBeChecked();
  });

  it("編集ダイアログは更新の Server Action を使う", async () => {
    const user = userEvent.setup();
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(actions.update).toHaveBeenCalled();
    });
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("編集ダイアログにはフォールバックの編集ページへのリンクを置く", async () => {
    const user = userEvent.setup();
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(
      screen.getByRole("link", { name: /編集ページを開く/ }),
    ).toHaveAttribute("href", "/transactions/t-1/edit");
  });

  it("所属グループが他にあれば編集ダイアログに反映UIを出す", async () => {
    const user = userEvent.setup();
    renderWithProvider(<EditTransactionButton transaction={transaction} />, [
      { id: "h-2", name: "別グループ" },
    ]);

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.getByText("他のグループへ反映")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "別グループ" }),
    ).toBeInTheDocument();
  });

  it("他の所属グループが無ければ反映UIを出さない", async () => {
    const user = userEvent.setup();
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.queryByText("他のグループへ反映")).not.toBeInTheDocument();
  });

  it("追加ボタンでは空のフォームと登録の Server Action を使う", async () => {
    const user = userEvent.setup();
    renderWithProvider(<NewTransactionButton />);

    await user.click(screen.getByRole("button", { name: /収支を追加/ }));

    expect(screen.getByRole("heading", { name: "収支を追加" })).toBeInTheDocument();
    expect(screen.getByLabelText("金額")).toHaveValue("");
    expect(
      screen.queryByRole("link", { name: /編集ページを開く/ }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("金額"), "500");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(actions.create).toHaveBeenCalled();
    });
  });

  it("追加ダイアログでも他のグループへ同時反映できる", async () => {
    const user = userEvent.setup();
    renderWithProvider(<NewTransactionButton />, [
      { id: "h-2", name: "別グループ" },
    ]);

    await user.click(screen.getByRole("button", { name: /収支を追加/ }));

    // 登録フォームの「他のグループにも反映する」（登録と同時にコピー）
    await user.click(screen.getByText(/他のグループにも反映する/));
    expect(
      screen.getByRole("checkbox", { name: "別グループ" }),
    ).toBeInTheDocument();
  });

  it("他の所属グループが無ければ追加ダイアログに同時反映UIを出さない", async () => {
    const user = userEvent.setup();
    renderWithProvider(<NewTransactionButton />);

    await user.click(screen.getByRole("button", { name: /収支を追加/ }));

    expect(
      screen.queryByText(/他のグループにも反映する/),
    ).not.toBeInTheDocument();
  });

  it("編集ダイアログでは登録時の同時反映UIを出さない（後追い反映を使う）", async () => {
    const user = userEvent.setup();
    renderWithProvider(<EditTransactionButton transaction={transaction} />, [
      { id: "h-2", name: "別グループ" },
    ]);

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(
      screen.queryByText(/他のグループにも反映する/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("他のグループへ反映")).toBeInTheDocument();
  });

  it("追加ダイアログでは「登録して続ける」で閉じずに連続入力できる", async () => {
    const user = userEvent.setup();
    actions.create.mockResolvedValue({ ok: true, key: "k-1" } as never);
    renderWithProvider(<NewTransactionButton />);

    await user.click(screen.getByRole("button", { name: /収支を追加/ }));
    const amount = screen.getByLabelText("金額") as HTMLInputElement;
    await user.type(amount, "300");
    await user.click(screen.getByRole("button", { name: "登録して続ける" }));

    // ダイアログは開いたまま、入力だけクリアされる
    await waitFor(() => {
      expect(amount.value).toBe("");
    });
    expect(screen.getByTestId("transaction-dialog")).toBeInTheDocument();
  });

  it("編集ダイアログには「登録して続ける」を出さない", async () => {
    const user = userEvent.setup();
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(
      screen.queryByRole("button", { name: "登録して続ける" }),
    ).not.toBeInTheDocument();
  });

  it("保存に成功したらダイアログを閉じる", async () => {
    const user = userEvent.setup();
    actions.update.mockResolvedValue({ ok: true, key: "k-1" } as never);
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "更新する" }));

    await waitFor(() => {
      expect(screen.queryByTestId("transaction-dialog")).not.toBeInTheDocument();
    });
  });

  it("保存に失敗したらダイアログを開いたままエラーを表示する", async () => {
    const user = userEvent.setup();
    actions.update.mockResolvedValue({ error: "収支の更新に失敗しました" } as never);
    renderWithProvider(<EditTransactionButton transaction={transaction} />);

    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "更新する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "収支の更新に失敗しました",
    );
    expect(screen.getByTestId("transaction-dialog")).toBeInTheDocument();
  });

  it("行ごとにダイアログを複製せず、開いている1つだけを描画する", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <>
        <EditTransactionButton transaction={transaction} />
        <EditTransactionButton
          transaction={{ ...transaction, id: "t-2", memo: "夕食" }}
        />
      </>,
    );

    await user.click(screen.getAllByRole("button", { name: "編集" })[1]);

    expect(screen.getAllByTestId("transaction-dialog")).toHaveLength(1);
    expect(screen.getByLabelText("メモ")).toHaveValue("夕食");
  });
});

describe("TransactionDialogProvider の名義人（spec 41）", () => {
  it("メンバーが2人以上なら追加ダイアログに名義人セレクトを出す", async () => {
    const user = userEvent.setup();
    renderWithProvider(<NewTransactionButton />, [], {
      members,
      currentUserId: TARO,
    });

    await user.click(screen.getByRole("button", { name: "収支を追加" }));

    expect(screen.getByLabelText("名義人")).toHaveValue(TARO);
  });

  it("編集ダイアログには現在の名義人がプリフィルされる", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <EditTransactionButton
        transaction={{ ...transaction, on_behalf_of: HANAKO }}
      />,
      [],
      { members, currentUserId: TARO },
    );

    await user.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.getByLabelText("名義人")).toHaveValue(HANAKO);
  });

  it("メンバーが渡されなければ名義人セレクトを出さない", async () => {
    const user = userEvent.setup();
    renderWithProvider(<NewTransactionButton />);

    await user.click(screen.getByRole("button", { name: "収支を追加" }));

    expect(screen.queryByLabelText("名義人")).not.toBeInTheDocument();
  });
});
