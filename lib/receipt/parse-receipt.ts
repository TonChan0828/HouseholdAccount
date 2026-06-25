// レシートの OCR テキストから「合計金額」と「日付」をヒューリスティックに抽出する純粋関数。
// LLM は使わず、正規化＋正規表現＋優先度ルールのみで実装する。精度は保証せず、
// 抽出結果はフォームへのプリフィル（ユーザーが確認・修正する前提）として利用する。

export type ParsedReceipt = {
  /** 合計金額（整数・円）。抽出できなければ null。 */
  amount: number | null;
  /** 購入日（YYYY-MM-DD）。抽出できなければ null。 */
  date: string | null;
};

const FULLWIDTH_MAP: Record<string, string> = {
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
  "，": ",", "．": ".", "￥": "¥", "－": "-", "ー": "-", "／": "/",
  "　": " ",
};

/** 全角の数字・記号を半角へ正規化する（レシート文面向け）。 */
function normalize(raw: string): string {
  let out = "";
  for (const ch of raw) {
    out += FULLWIDTH_MAP[ch] ?? ch;
  }
  return out;
}

// 合計を表すキーワード（優先度順）。小計・中計は除外する。
const TOTAL_KEYWORDS_PRIMARY = ["合計", "お会計", "ご請求", "請求金額"];
const TOTAL_KEYWORDS_SECONDARY = ["お買上", "総計", "total"];

const AMOUNT_MIN = 1;
const AMOUNT_MAX = 9_999_999;

/** 行内の数値グループ（カンマ区切り可）を出現順に整数で返す。 */
function numbersInLine(line: string): number[] {
  const out: number[] = [];
  const re = /\d{1,3}(?:,\d{3})+|\d+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function inRange(n: number): boolean {
  return Number.isInteger(n) && n >= AMOUNT_MIN && n <= AMOUNT_MAX;
}

/** キーワード行から合計金額を抽出する（同一行の右端の数値を採用）。 */
function extractTotalAmount(lines: string[]): number | null {
  for (const tiers of [TOTAL_KEYWORDS_PRIMARY, TOTAL_KEYWORDS_SECONDARY]) {
    const candidates: number[] = [];
    for (const line of lines) {
      // OCR のスペース混入に備え、キーワード判定は空白除去後に行う。
      const compact = line.replace(/\s/g, "");
      if (compact.includes("小計") || compact.includes("中計")) continue;
      const hit = tiers.some((kw) =>
        compact.toLowerCase().includes(kw.toLowerCase()),
      );
      if (!hit) continue;
      const nums = numbersInLine(line).filter(inRange);
      if (nums.length > 0) candidates.push(nums[nums.length - 1]);
    }
    if (candidates.length > 0) return Math.max(...candidates);
  }
  return null;
}

/** 通貨らしいトークン（¥前置・円後置・カンマ区切り）の最大値をフォールバックにする。 */
function extractFallbackAmount(text: string): number | null {
  const candidates: number[] = [];
  const re =
    /[¥\\]\s?(\d{1,3}(?:,\d{3})*|\d+)|(\d{1,3}(?:,\d{3})*|\d+)\s?円|(\d{1,3}(?:,\d{3})+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3];
    if (!raw) continue;
    const n = Number(raw.replace(/,/g, ""));
    if (inRange(n)) candidates.push(n);
  }
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 日付を抽出する。年付きを優先し、無ければ MM/DD を今日の年で補完する。 */
function extractDate(text: string, today: Date): string | null {
  // 1) 年付き: YYYY[区切り]MM[区切り]DD（区切りは / - . 年月日）
  const withYear =
    /(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/.exec(text);
  if (withYear) {
    const year = Number(withYear[1]);
    if (year >= 2000 && year <= today.getFullYear() + 1) {
      const date = buildDate(year, Number(withYear[2]), Number(withYear[3]));
      if (date) return date;
    }
  }

  // 2) 年なし: MM/DD（/ - 月日 のみ。コロン区切りの時刻は対象外）
  const re = /(?<![\d:])(\d{1,2})\s*[月/-]\s*(\d{1,2})\s*日?(?![\d:])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const date = buildDate(today.getFullYear(), Number(m[1]), Number(m[2]));
    if (date) return date;
  }

  return null;
}

/**
 * OCR テキストから合計金額と日付を抽出する。
 * @param rawText OCR の生テキスト
 * @param today 年補完の基準日（省略時は現在日時。テスト容易性のため引数化）
 */
export function parseReceipt(
  rawText: string,
  today: Date = new Date(),
): ParsedReceipt {
  if (typeof rawText !== "string" || rawText.trim() === "") {
    return { amount: null, date: null };
  }

  const text = normalize(rawText);
  const lines = text.split(/\r?\n/);

  const amount = extractTotalAmount(lines) ?? extractFallbackAmount(text);
  const date = extractDate(text, today);

  return { amount, date };
}
