import { describe, expect, it } from "vitest";
import { evaluateCell, columnLabel } from "./formulas";
import type { SheetCell } from "../types";
const cells = (rows: string[][]): SheetCell[][] =>
  rows.map((row) => row.map((value) => ({ value })));
describe("spreadsheet formulas", () => {
  it("matches spreadsheet division errors for an empty average", () => {
    expect(evaluateCell(cells([["", "=AVERAGE(A1:A1)"]]), 0, 1)).toBe(
      "#DIV/0!"
    );
  });
  it("calculates arithmetic precedence, references, ranges and aggregate functions", () => {
    const rows = cells([
      [
        "2",
        "3",
        "=A1+B1*4",
        "=SUM(A1:B1)",
        "=AVERAGE(A1:B1)",
        "=MIN(A1:B1)",
        "=MAX(A1:B1)",
        "=COUNT(A1:B1)",
      ],
    ]);
    expect(evaluateCell(rows, 0, 2)).toBe(14);
    expect(evaluateCell(rows, 0, 3)).toBe(5);
    expect(evaluateCell(rows, 0, 4)).toBe(2.5);
    expect(evaluateCell(rows, 0, 5)).toBe(2);
    expect(evaluateCell(rows, 0, 6)).toBe(3);
    expect(evaluateCell(rows, 0, 7)).toBe(2);
  });
  it("supports nested functions, unary signs and absolute references", () => {
    const rows = cells([["8", "=-(SUM($A$1,2)/2)+MAX(3,4)"]]);
    expect(evaluateCell(rows, 0, 1)).toBe(-1);
  });
  it("handles cycles, invalid syntax, malicious input and zero divisors without executing code", () => {
    const rows = cells([
      ["=B1", "=A1", "=1/0", "=globalThis.alert(1)", "=1+", "=A99999"],
    ]);
    expect(evaluateCell(rows, 0, 0)).toBe("#CYCLE!");
    expect(evaluateCell(rows, 0, 2)).toBe("#DIV/0!");
    expect(evaluateCell(rows, 0, 3)).toBe("#ERROR!");
    expect(evaluateCell(rows, 0, 4)).toBe("#ERROR!");
    expect(evaluateCell(rows, 0, 5)).toBe(0);
  });
  it("ignores text in scalar aggregate references and rejects invalid row addresses", () => {
    const rows = cells([
      ["notes", "9", "=COUNT(A1,B1)", "=AVERAGE(A1,B1)", "=A0"],
    ]);
    expect(evaluateCell(rows, 0, 2)).toBe(1);
    expect(evaluateCell(rows, 0, 3)).toBe(9);
    expect(evaluateCell(rows, 0, 4)).toBe("#REF!");
  });
  it("preserves text and ignores empty/text cells in COUNT and AVERAGE", () => {
    const rows = cells([
      ["hello", "", "6", "=COUNT(A1:C1)", "=AVERAGE(A1:C1)"],
    ]);
    expect(evaluateCell(rows, 0, 0)).toBe("hello");
    expect(evaluateCell(rows, 0, 3)).toBe(1);
    expect(evaluateCell(rows, 0, 4)).toBe(6);
    expect(columnLabel(26)).toBe("AA");
  });
});
