// 金額欄の四則演算式を評価する純粋関数。eval は使わず、トークナイザ＋再帰下降パーサで実装する。
// 文法:
//   expr   = term (('+'|'-') term)*
//   term   = factor (('*'|'/') factor)*
//   factor = number | '(' expr ')' | ('+'|'-') factor

const FULLWIDTH_MAP: Record<string, string> = {
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
  "（": "(", "）": ")", "＋": "+", "－": "-", "×": "*", "÷": "/", "．": ".",
};

/** 全角→半角に正規化し、×÷ を乗除記号へ、空白を除去する。 */
function normalize(raw: string): string {
  let out = "";
  for (const ch of raw) {
    if (ch === " " || ch === "\t" || ch === "　") continue;
    const mapped = FULLWIDTH_MAP[ch];
    out += mapped ?? (ch === "×" ? "*" : ch === "÷" ? "/" : ch);
  }
  return out;
}

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" };

/** 正規化済み文字列をトークン列に変換する。不正な文字があれば null。 */
function tokenize(s: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", value: ch });
      i++;
    } else if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
    } else if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
    } else if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) {
        j++;
      }
      const numStr = s.slice(i, j);
      // "1.2.3" のような複数小数点を弾く
      if ((numStr.match(/\./g)?.length ?? 0) > 1) return null;
      const value = Number(numStr);
      if (!Number.isFinite(value)) return null;
      tokens.push({ kind: "num", value });
      i = j;
    } else {
      return null;
    }
  }
  return tokens;
}

/**
 * 四則演算式を評価し、生の数値（小数を含みうる）を返す。
 * 構文エラー・0除算・非有限なら null。
 */
export function evaluateExpression(raw: string): number | null {
  if (typeof raw !== "string") return null;
  const normalized = normalize(raw);
  if (normalized === "") return null;

  const tokens = tokenize(normalized);
  if (tokens === null || tokens.length === 0) return null;

  let pos = 0;
  let failed = false;

  const peek = (): Token | undefined => tokens[pos];

  const parseFactor = (): number => {
    const t = peek();
    if (!t) {
      failed = true;
      return NaN;
    }
    if (t.kind === "op" && (t.value === "+" || t.value === "-")) {
      pos++;
      const v = parseFactor();
      return t.value === "-" ? -v : v;
    }
    if (t.kind === "lparen") {
      pos++;
      const v = parseExpr();
      const close = peek();
      if (!close || close.kind !== "rparen") {
        failed = true;
        return NaN;
      }
      pos++;
      return v;
    }
    if (t.kind === "num") {
      pos++;
      return t.value;
    }
    failed = true;
    return NaN;
  };

  const parseTerm = (): number => {
    let v = parseFactor();
    while (!failed) {
      const t = peek();
      if (t?.kind === "op" && (t.value === "*" || t.value === "/")) {
        pos++;
        const rhs = parseFactor();
        if (t.value === "*") {
          v = v * rhs;
        } else {
          if (rhs === 0) {
            failed = true;
            return NaN;
          }
          v = v / rhs;
        }
      } else {
        break;
      }
    }
    return v;
  };

  function parseExpr(): number {
    let v = parseTerm();
    while (!failed) {
      const t = peek();
      if (t?.kind === "op" && (t.value === "+" || t.value === "-")) {
        pos++;
        const rhs = parseTerm();
        v = t.value === "+" ? v + rhs : v - rhs;
      } else {
        break;
      }
    }
    return v;
  }

  const result = parseExpr();
  if (failed || pos !== tokens.length) return null;
  if (!Number.isFinite(result)) return null;
  return result;
}

/**
 * 金額として式を評価し、四捨五入した整数を返す。無効な式は NaN。
 * zod スキーマの preprocess から利用する。
 */
export function evaluateAmount(raw: string): number {
  const value = evaluateExpression(raw);
  return value === null ? NaN : Math.round(value);
}
