import type { SheetCell } from "../types";

type Value = number | string;
class FormulaError extends Error {}
export function columnLabel(index: number): string {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}
function address(token: string): [number, number] {
  const match = /^\$?([A-Z]+)\$?(\d+)$/.exec(token);
  if (!match) throw new FormulaError("#REF!");
  let col = 0;
  for (const char of match[1]) col = col * 26 + char.charCodeAt(0) - 64;
  if (Number(match[2]) < 1 || Number(match[2]) > 1048576 || col > 16384)
    throw new FormulaError("#REF!");
  return [Number(match[2]) - 1, col - 1];
}
function numeric(value: Value): number {
  if (value === "") return 0;
  if (typeof value === "number") return value;
  if (value.startsWith("#")) throw new FormulaError(value);
  const num = Number(value);
  if (!Number.isFinite(num)) throw new FormulaError("#VALUE!");
  return num;
}
/** A small recursive-descent evaluator. Formula strings are never JavaScript. */
export function evaluateCell(
  rows: SheetCell[][],
  row: number,
  col: number,
  seen = new Set<string>()
): Value {
  const raw = rows[row]?.[col]?.value ?? "";
  if (!raw.startsWith("="))
    return raw.trim() !== "" && Number.isFinite(Number(raw))
      ? Number(raw)
      : raw;
  const key = `${row}:${col}`;
  if (seen.has(key)) return "#CYCLE!";
  if (seen.size > 200 || raw.length > 4096) return "#LIMIT!";
  const visited = new Set(seen).add(key);
  try {
    const source = raw.slice(1).toUpperCase().replace(/\s+/g, "");
    const tokens =
      source.match(
        /\$?[A-Z]+\$?\d+|[A-Z]+|(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|[+\-*/^(),:]/g
      ) ?? [];
    if (tokens.join("") !== source || !tokens.length)
      throw new FormulaError("#ERROR!");
    let pos = 0;
    const peek = () => tokens[pos];
    const take = (expected?: string) => {
      const token = tokens[pos++];
      if (!token || (expected && token !== expected))
        throw new FormulaError("#ERROR!");
      return token;
    };
    const reference = (token: string) => {
      const [r, c] = address(token);
      return evaluateCell(rows, r, c, visited);
    };
    const primary = (): number => {
      if (peek() === "+") {
        take();
        return primary();
      }
      if (peek() === "-") {
        take();
        return -primary();
      }
      if (peek() === "(") {
        take();
        const value = sum();
        take(")");
        return value;
      }
      const token = take();
      if (/^[\d.]/.test(token)) return Number(token);
      if (/\d$/.test(token)) return numeric(reference(token));
      if (!["SUM", "AVERAGE", "MIN", "MAX", "COUNT"].includes(token))
        throw new FormulaError("#ERROR!");
      take("(");
      const values: number[] = [];
      while (peek() !== ")") {
        if (tokens[pos + 1] === ":") {
          const start = address(take());
          take(":");
          const end = address(take());
          const r1 = Math.min(start[0], end[0]),
            r2 = Math.max(start[0], end[0]);
          const c1 = Math.min(start[1], end[1]),
            c2 = Math.max(start[1], end[1]);
          if ((r2 - r1 + 1) * (c2 - c1 + 1) > 10000)
            throw new FormulaError("#LIMIT!");
          for (let r = r1; r <= r2; r++)
            for (let c = c1; c <= c2; c++) {
              const val = evaluateCell(rows, r, c, visited);
              if (typeof val === "number") values.push(val);
              else if (val.startsWith("#")) throw new FormulaError(val);
            }
        } else if (
          /^\$?[A-Z]+\$?\d+$/.test(peek() ?? "") &&
          [",", ")"].includes(tokens[pos + 1])
        ) {
          const value = reference(take());
          if (typeof value === "number") values.push(value);
          else if (value.startsWith("#")) throw new FormulaError(value);
        } else values.push(sum());
        if (peek() !== ",") break;
        take(",");
      }
      take(")");
      if (token === "COUNT") return values.length;
      if (token === "SUM") return values.reduce((a, b) => a + b, 0);
      if (!values.length) {
        if (token === "AVERAGE") throw new FormulaError("#DIV/0!");
        return 0;
      }
      if (token === "AVERAGE")
        return values.reduce((a, b) => a + b, 0) / values.length;
      return token === "MIN" ? Math.min(...values) : Math.max(...values);
    };
    const power = (): number => {
      const value = primary();
      if (peek() === "^") {
        take();
        return value ** power();
      }
      return value;
    };
    const product = (): number => {
      let value = power();
      while (peek() === "*" || peek() === "/") {
        const op = take(),
          rhs = power();
        if (op === "/" && rhs === 0) throw new FormulaError("#DIV/0!");
        value = op === "*" ? value * rhs : value / rhs;
      }
      return value;
    };
    const sum = (): number => {
      let value = product();
      while (peek() === "+" || peek() === "-") {
        const op = take(),
          rhs = product();
        value = op === "+" ? value + rhs : value - rhs;
      }
      return value;
    };
    const result = sum();
    if (pos !== tokens.length) throw new FormulaError("#ERROR!");
    return Number.isFinite(result) ? result : "#NUM!";
  } catch (error) {
    return error instanceof FormulaError ? error.message : "#ERROR!";
  }
}
export function displayCell(
  rows: SheetCell[][],
  row: number,
  col: number
): string {
  const result = evaluateCell(rows, row, col);
  if (typeof result !== "number") return result;
  switch (rows[row]?.[col]?.format) {
    case "currency":
      return result.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
    case "percent":
      return `${Number((result * 100).toFixed(4))}%`;
    default:
      return String(Number(result.toPrecision(12)));
  }
}
