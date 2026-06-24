import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoggedOutToast } from "./logged-out-toast";

const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replaceCalls: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => state.params,
  useRouter: () => ({
    replace: (url: string) => {
      state.replaceCalls.push(url);
    },
  }),
}));

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: { success: toastSuccess },
}));

beforeEach(() => {
  state.params = new URLSearchParams();
  state.replaceCalls = [];
  toastSuccess.mockClear();
});

describe("LoggedOutToast", () => {
  it("loggedout=1 のとき「ログアウトしました」トーストを表示し URL を / に置き換える", () => {
    state.params = new URLSearchParams("loggedout=1");

    render(<LoggedOutToast />);

    expect(toastSuccess).toHaveBeenCalledWith("ログアウトしました");
    expect(state.replaceCalls).toEqual(["/"]);
  });

  it("loggedout が無いときはトーストを表示しない", () => {
    render(<LoggedOutToast />);

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(state.replaceCalls).toEqual([]);
  });
});
