import { describe, expect, it, vi } from "vitest";

import { releaseCommit } from "./release-production.mjs";

function operations() {
  return {
    assertLatest: vi.fn(),
    checkBefore: vi.fn(),
    apply: vi.fn(),
    checkAfter: vi.fn(),
    deploy: vi.fn(() => "https://example.vercel.app"),
    smoke: vi.fn(),
    promote: vi.fn(),
    verifyLive: vi.fn(),
  };
}

describe("production release", () => {
  it("applies and checks the schema before promoting a verified candidate", () => {
    const workflow = operations();
    releaseCommit(workflow);
    expect(workflow.apply).toHaveBeenCalledAfter(workflow.checkBefore);
    expect(workflow.deploy).toHaveBeenCalledAfter(workflow.checkAfter);
    expect(workflow.promote).toHaveBeenCalledAfter(workflow.smoke);
    expect(workflow.promote).toHaveBeenCalledWith("https://example.vercel.app");
    expect(workflow.verifyLive).toHaveBeenCalledAfter(workflow.promote);
    expect(workflow.verifyLive).toHaveBeenCalledWith("https://example.vercel.app");
  });

  it.each(["checkBefore", "apply", "checkAfter"] as const)("stops before deployment if %s fails", (step) => {
    const workflow = operations();
    workflow[step].mockImplementation(() => { throw new Error(step); });
    expect(() => releaseCommit(workflow)).toThrow(step);
    expect(workflow.deploy).not.toHaveBeenCalled();
  });

  it("does not promote a candidate with a failed smoke check", () => {
    const workflow = operations();
    workflow.smoke.mockImplementation(() => { throw new Error("smoke"); });
    expect(() => releaseCommit(workflow)).toThrow("smoke");
    expect(workflow.promote).not.toHaveBeenCalled();
  });

  it("does not promote a candidate if main changed before promotion", () => {
    const workflow = operations();
    workflow.assertLatest.mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => { throw new Error("main changed"); });
    expect(() => releaseCommit(workflow)).toThrow("main changed");
    expect(workflow.promote).not.toHaveBeenCalled();
  });
});
