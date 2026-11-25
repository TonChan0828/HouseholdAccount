import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TransactionActionState } from "@/app/(dashboard)/transactions/actions";
import type { Category } from "@/types";

import { TransactionForm } from "./transaction-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const noop = async () => undefined;

const categories: Category[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    household_id: "h1",
    name: "食費",
    color: "#ef4444",
    icon: null,
    type: "expense",
    is_default: true,
    is_hidden: false,
    reminder_enabled: false,
    sort_order: 1,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    household_id: "h1",
    name: "給与",
    color: "#10b981",
    icon: null,
    type: "income",
    is_default: true,
    is_hidden: false,
    reminder_enabled: false,
    sort_order: 1,
  },
];

const TARO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HANAKO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const twoMembers = [
  { user_id: TARO, display_name: "太郎" },
  { user_id: HANAKO, display_name: "花子" },
];

function renderForm(props?: {
  action?: (
    state: TransactionActionState,
    formData: FormData,
  ) => Promise<TransactionActionState>;
  enableContinue?: boolean;
  members?: { user_id: string; display_name: string }[];
  currentUserId?: string;
  defaultValues?: { on_behalf_of?: string | null };
}) {
  return render(
    <TransactionForm
      action={props?.action ?? noop}
      categories={categories}
      submitLabel="登録する"
      enableContinue={props?.enableContinue}
      members={props?.members}
      currentUserId={props?.currentUserId}
      defaultValues={props?.defaultValues}
    />,
  );
}

describe("TransactionForm", () => {
  it("金額・日付・カテゴリ・メモの入力欄と送信ボタンを表示する", () => {
    renderForm();

    expect(screen.getByLabelText("金額")).toBeInTheDocument();
    expect(screen.getByLabelText("日付")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "カテゴリ" })).toBeInTheDocument();
    expect(screen.getByLabelText("メモ")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登録する" }),
    ).toBeInTheDocument();
  });

  it("支出/収入のトグルを表示する", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "支出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "収入" })).toBeInTheDocument();
  });

  it("デフォルト（支出）では支出カテゴリのチップを出す", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "食費" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "給与" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "未選択" })).toBeInTheDocument();
  });

  it("収入に切り替えると収入カテゴリのチップに入れ替わる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "収入" }));

    expect(screen.getByRole("radio", { name: "給与" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "食費" })).not.toBeInTheDocument();
  });

  it("連続入力でカテゴリを引き継ぐ設定と表示中の登録先を送信に反映する", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(state: TransactionActionState, data: FormData) => Promise<TransactionActionState>>(async () => ({
      ok: true as const,
      key: "saved",
    }));
    render(
      <TransactionForm
        action={action}
        categories={categories}
        household={{ id: "h1", name: "家の家計簿" }}
        submitLabel="登録する"
        enableContinue
      />,
    );

    expect(screen.getByText("家の家計簿")).toBeVisible();
    await user.type(screen.getByLabelText("金額"), "250");
    await user.click(screen.getByRole("radio", { name: "食費" }));
    await user.click(screen.getByRole("checkbox", { name: "カテゴリも引き継ぐ" }));
    await user.click(screen.getByRole("button", { name: "登録して続ける" }));

    await waitFor(() => expect(screen.getByLabelText("金額")).toHaveValue(""));
    expect(action.mock.calls[0]?.[1].get("_household")).toBe("h1");
    expect(action.mock.calls[0]?.[1].get("_continue")).toBe("1");
    expect(action.mock.calls[0]?.[1].get("_request_key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByRole("radio", { name: "食費" })).toBeChecked();
  });

  it("enableContinue 未指定では「登録して続ける」ボタンを出さない", () => {
    renderForm();

    expect(
      screen.queryByRole("button", { name: "登録して続ける" }),
    ).not.toBeInTheDocument();
  });

  it("enableContinue 指定時は「登録して続ける」ボタンを出す", () => {
    renderForm({ enableContinue: true });

    expect(
      screen.getByRole("button", { name: "登録して続ける" }),
    ).toBeInTheDocument();
  });

  it("金額欄に四則演算が使えるヒントを表示する", () => {
    renderForm();

    expect(screen.getByText("+ − × ÷ で計算できます")).toBeInTheDocument();
    expect(
      (screen.getByLabelText("金額") as HTMLInputElement).placeholder,
    ).toBe("1000");
  });

  it("金額欄に四則演算式を入力すると計算結果のプレビューを表示する", async () => {
    const user = userEvent.setup();
    renderForm();

    const amount = screen.getByLabelText("金額");
    await user.type(amount, "1000+500");

    expect(screen.getByText("= ¥1,500")).toBeInTheDocument();
  });

  it("評価できない式では「計算できません」を表示する", async () => {
    const user = userEvent.setup();
    renderForm();

    const amount = screen.getByLabelText("金額");
    await user.type(amount, "1000+");

    expect(screen.getByText("計算できません")).toBeInTheDocument();
  });

  it("演算子を含まないプレーン数値ではプレビューを出さない", async () => {
    const user = userEvent.setup();
    renderForm();

    const amount = screen.getByLabelText("金額");
    await user.type(amount, "1500");

    expect(screen.queryByText(/= ¥/)).not.toBeInTheDocument();
    expect(screen.queryByText("計算できません")).not.toBeInTheDocument();
  });

  describe("精算対象（割り勘）チェックボックス", () => {
    it("支出のとき表示され、既定は未チェック", () => {
      renderForm();

      const checkbox = screen.getByRole("checkbox", {
        name: /精算対象（割り勘）/,
      });
      expect(checkbox).not.toBeChecked();
    });

    it("収入に切り替えると表示されない", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole("radio", { name: "収入" }));

      expect(
        screen.queryByRole("checkbox", { name: /精算対象（割り勘）/ }),
      ).not.toBeInTheDocument();
    });

    it("defaultValues.is_shared=true でチェック済みになる", () => {
      render(
        <TransactionForm
          action={noop}
          categories={categories}
          submitLabel="更新する"
          defaultValues={{ type: "expense", is_shared: true }}
        />,
      );

      expect(
        screen.getByRole("checkbox", { name: /精算対象（割り勘）/ }),
      ).toBeChecked();
    });
  });

  it("「登録して続ける」成功後は金額・メモ・カテゴリをクリアし日付は維持する", async () => {
    const user = userEvent.setup();
    const action = async (): Promise<TransactionActionState> => ({
      ok: true,
      key: Math.random().toString(),
    });
    renderForm({ action, enableContinue: true });

    const amount = screen.getByLabelText("金額") as HTMLInputElement;
    const memo = screen.getByLabelText("メモ") as HTMLTextAreaElement;
    const date = screen.getByLabelText("日付") as HTMLInputElement;
    const dateValue = date.value;

    await user.type(amount, "1500");
    await user.type(memo, "ランチ");
    await user.click(screen.getByRole("radio", { name: "食費" }));

    await user.click(screen.getByRole("button", { name: "登録して続ける" }));

    await waitFor(() => {
      expect(amount.value).toBe("");
    });
    expect(memo.value).toBe("");
    expect(date.value).toBe(dateValue);
    expect(
      (screen.getByRole("radio", { name: "未選択" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("保存に失敗しても入力値を保持する", async () => {
    const user = userEvent.setup();
    const action = async (): Promise<TransactionActionState> => ({
      error: "収支の登録に失敗しました",
    });
    renderForm({ action });

    const amount = screen.getByLabelText("金額") as HTMLInputElement;
    const memo = screen.getByLabelText("メモ") as HTMLTextAreaElement;
    await user.type(amount, "1500");
    await user.type(memo, "ランチ");

    await user.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "収支の登録に失敗しました",
      );
    });
    expect(amount.value).toBe("1500");
    expect(memo.value).toBe("ランチ");
  });

  describe("ダイアログからの利用（spec 40）", () => {
    const okAction = async (): Promise<TransactionActionState> => ({
      ok: true,
      key: Math.random().toString(),
    });

    it("dialog 指定時は _dialog=1 の hidden input を送る", () => {
      const { container } = render(
        <TransactionForm
          action={noop}
          categories={categories}
          submitLabel="更新する"
          dialog
        />,
      );

      expect(
        container.querySelector('input[name="_dialog"]'),
      ).toHaveValue("1");
    });

    it("dialog 未指定なら _dialog は送らない", () => {
      const { container } = renderForm();

      expect(container.querySelector('input[name="_dialog"]')).toBeNull();
    });

    it("成功したら onSuccess を呼ぶ", async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      render(
        <TransactionForm
          action={okAction}
          categories={categories}
          submitLabel="更新する"
          dialog
          onSuccess={onSuccess}
        />,
      );

      await user.type(screen.getByLabelText("金額"), "1500");
      await user.click(screen.getByRole("button", { name: "更新する" }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("成功しても入力欄はクリアしない（ダイアログは閉じるため）", async () => {
      const user = userEvent.setup();
      render(
        <TransactionForm
          action={okAction}
          categories={categories}
          submitLabel="更新する"
          dialog
          onSuccess={() => {}}
        />,
      );

      const amount = screen.getByLabelText("金額") as HTMLInputElement;
      await user.type(amount, "1500");
      await user.click(screen.getByRole("button", { name: "更新する" }));

      await waitFor(() => {
        expect(amount.value).toBe("1500");
      });
    });

    it("showReceiptScan=false でレシート読み取りの案内を出さない", () => {
      render(
        <TransactionForm
          action={noop}
          categories={categories}
          submitLabel="更新する"
          dialog
          showReceiptScan={false}
        />,
      );

      expect(screen.queryByText(/レシート画像から/)).not.toBeInTheDocument();
    });

    it("既定ではレシート読み取りの案内を出す", () => {
      renderForm();

      expect(screen.getByText(/レシート画像から/)).toBeInTheDocument();
    });
  });
});

describe("TransactionForm 名義人（代理入力・spec 41）", () => {
  it("メンバーが渡されないときは名義人セレクトを表示しない", () => {
    renderForm();

    expect(screen.queryByLabelText("名義人")).not.toBeInTheDocument();
  });

  it("メンバーが1人だけのグループでは名義人セレクトを表示しない", () => {
    renderForm({
      members: [{ user_id: TARO, display_name: "太郎" }],
      currentUserId: TARO,
    });

    expect(screen.queryByLabelText("名義人")).not.toBeInTheDocument();
  });

  it("メンバーが2人以上なら名義人セレクトを表示し、既定で自分を選ぶ", () => {
    renderForm({ members: twoMembers, currentUserId: TARO });

    const select = screen.getByLabelText("名義人");
    expect(select).toHaveValue(TARO);
    expect(
      screen.getByRole("option", { name: "太郎（自分）" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "花子" })).toBeInTheDocument();
  });

  it("編集時は現在の名義人が選択された状態で開く", () => {
    renderForm({
      members: twoMembers,
      currentUserId: TARO,
      defaultValues: { on_behalf_of: HANAKO },
    });

    expect(screen.getByLabelText("名義人")).toHaveValue(HANAKO);
  });

  it("選んだ名義人を FormData の on_behalf_of として送信する", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: TransactionActionState, formData: FormData) => {
      expect(formData.get("on_behalf_of")).toBe(HANAKO);
      return undefined;
    });

    renderForm({ action, members: twoMembers, currentUserId: TARO });

    await user.type(screen.getByLabelText("金額"), "1200");
    await user.selectOptions(screen.getByLabelText("名義人"), HANAKO);
    await user.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
  });

  it("「登録して続ける」で成功しても名義人は維持する", async () => {
    const user = userEvent.setup();
    const action = async () => ({ ok: true as const, key: "k1" });

    renderForm({
      action,
      enableContinue: true,
      members: twoMembers,
      currentUserId: TARO,
    });

    await user.type(screen.getByLabelText("金額"), "1200");
    await user.selectOptions(screen.getByLabelText("名義人"), HANAKO);
    await user.click(screen.getByRole("button", { name: "登録して続ける" }));

    // 金額はクリアされるが、続けて同じ人の分を入力できるよう名義人は残す
    await waitFor(() => expect(screen.getByLabelText("金額")).toHaveValue(""));
    expect(screen.getByLabelText("名義人")).toHaveValue(HANAKO);
  });
});
