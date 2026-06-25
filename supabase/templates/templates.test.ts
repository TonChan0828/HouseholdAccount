import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 認証メールテンプレートのガード。
 * リンク機構（PKCE の {{ .ConfirmationURL }}）を壊さず、ブランド化されていることを保証する。
 * 仕様: docs/specs/24_auth_email_templates.md
 */
const TEMPLATES = ["confirmation", "recovery", "email_change"] as const;

function readTemplate(name: string): string {
  return readFileSync(join(__dirname, `${name}.html`), "utf-8");
}

describe("auth email templates", () => {
  it.each(TEMPLATES)("%s はアクションリンク変数 {{ .ConfirmationURL }} を含む", (name) => {
    expect(readTemplate(name)).toContain("{{ .ConfirmationURL }}");
  });

  it.each(TEMPLATES)("%s は Shallet ブランドを含む", (name) => {
    expect(readTemplate(name)).toContain("Shallet");
  });

  it.each(TEMPLATES)("%s はデフォルト英語テンプレートの残骸を含まない", (name) => {
    const html = readTemplate(name);
    expect(html).not.toMatch(/Confirm your mail|Reset Password|Follow this link/i);
  });

  it.each(TEMPLATES)("%s は日本語 lang 指定の HTML である", (name) => {
    expect(readTemplate(name)).toContain('lang="ja"');
  });
});
