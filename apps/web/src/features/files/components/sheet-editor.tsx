"use client";
import { useState } from "react";
import { columnLabel, displayCell } from "../lib/formulas";
import type { SheetCell, WorkbookContent } from "../types";
export function SheetEditor({
  content,
  onChange,
  readOnly,
}: {
  content: WorkbookContent;
  onChange: (value: WorkbookContent) => void;
  readOnly: boolean;
}) {
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [active, setActive] = useState<[number, number]>([0, 0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [rowPage, setRowPage] = useState(0);
  const index = Math.min(selectedSheet, content.sheets.length - 1);
  const sheet = content.sheets[index];
  if (!sheet) return <p>No sheets.</p>;
  const cell = sheet.rows[active[0]]?.[active[1]] ?? { value: "" };
  const changeRows = (rows: SheetCell[][]) =>
    onChange({
      ...content,
      sheets: content.sheets.map((item, i) =>
        i === index ? { ...item, rows } : item
      ),
    });
  const updateCell = (r: number, c: number, patch: Partial<SheetCell>) => {
    const rows = Array.from(
      { length: Math.max(sheet.rows.length, r + 1) },
      (_, row) =>
        Array.from(
          { length: Math.max(sheet.rows[row]?.length ?? 0, c + 1) },
          (_, col) => ({
            ...(sheet.rows[row]?.[col] ?? { value: "" }),
            ...(row === r && col === c ? patch : {}),
          })
        )
    );
    changeRows(rows);
  };
  const rowCount = Math.max(16, sheet.rows.length),
    colCount = Math.max(8, ...sheet.rows.map((row) => row.length));
  const page = Math.min(rowPage, Math.floor((rowCount - 1) / 50));
  const rowStart = page * 50;
  const visibleRows = Math.min(50, rowCount - rowStart);
  return (
    <div className="file-sheet-editor">
      <div className="file-toolbar">
        <button
          disabled={readOnly}
          aria-pressed={!!cell.bold}
          onClick={() => updateCell(...active, { bold: !cell.bold })}
        >
          <strong>Bold</strong>
        </button>
        <label>
          Format{" "}
          <select
            disabled={readOnly}
            value={cell.format ?? "text"}
            onChange={(e) =>
              updateCell(...active, {
                format: e.target.value as SheetCell["format"],
              })
            }
          >
            <option value="text">General</option>
            <option value="number">Number</option>
            <option value="currency">Currency (USD)</option>
            <option value="percent">Percent</option>
          </select>
        </label>
        <button
          disabled={readOnly || sheet.rows.length >= 2000}
          onClick={() => {
            changeRows([
              ...sheet.rows,
              Array.from({ length: colCount }, () => ({ value: "" })),
            ]);
            setRowPage(Math.floor(sheet.rows.length / 50));
          }}
        >
          + Row
        </button>
        <button
          disabled={readOnly || colCount >= 100}
          onClick={() =>
            changeRows(
              Array.from({ length: rowCount }, (_, i) => [
                ...Array.from(
                  { length: colCount },
                  (_, j) => sheet.rows[i]?.[j] ?? { value: "" }
                ),
                { value: "" },
              ])
            )
          }
        >
          + Column
        </button>
      </div>
      <div className="file-formula-bar">
        <span>
          {columnLabel(active[1])}
          {active[0] + 1}
        </span>
        <label htmlFor="file-formula">fx</label>
        <input
          id="file-formula"
          aria-label="Cell value or formula"
          value={cell.value}
          disabled={readOnly}
          onChange={(e) => updateCell(...active, { value: e.target.value })}
          placeholder="Enter a value or =SUM(A1:A5)"
        />
      </div>
      <div className="file-sheet-scroll">
        <table className="file-grid" aria-label={sheet.name}>
          <thead>
            <tr>
              <th aria-label="Row number" />
              {Array.from({ length: colCount }, (_, col) => (
                <th key={col}>{columnLabel(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: visibleRows }, (_, offset) => {
              const r = rowStart + offset;
              return (
                <tr key={r}>
                  <th scope="row">{r + 1}</th>
                  {Array.from({ length: colCount }, (_, c) => (
                    <td key={c}>
                      <input
                        aria-label={`${columnLabel(c)}${r + 1}`}
                        className={`${active[0] === r && active[1] === c ? "active" : ""} ${sheet.rows[r]?.[c]?.bold ? "bold" : ""}`}
                        readOnly={readOnly}
                        value={
                          editing === `${r}:${c}`
                            ? (sheet.rows[r]?.[c]?.value ?? "")
                            : displayCell(sheet.rows, r, c)
                        }
                        onFocus={() => {
                          setActive([r, c]);
                          setEditing(`${r}:${c}`);
                        }}
                        onBlur={() => setEditing(null)}
                        onChange={(e) =>
                          updateCell(r, c, { value: e.target.value })
                        }
                        onPaste={(e) => {
                          if (readOnly) return;
                          const text = e.clipboardData.getData("text/plain");
                          if (!text.includes("\t") && !text.includes("\n"))
                            return;
                          e.preventDefault();
                          const pasted = text
                            .replace(/\r/g, "")
                            .replace(/\n$/, "")
                            .split("\n")
                            .map((row) => row.split("\t"));
                          if (
                            pasted.length > 500 ||
                            r + pasted.length > 2000 ||
                            pasted.some(
                              (row) => row.length > 100 || c + row.length > 100
                            )
                          ) {
                            window.alert(
                              "Paste up to 500 rows at a time, within 2,000 rows and 100 columns."
                            );
                            return;
                          }
                          const rows = Array.from(
                            {
                              length: Math.max(
                                sheet.rows.length,
                                r + pasted.length
                              ),
                            },
                            (_, ri) =>
                              Array.from(
                                {
                                  length: Math.max(
                                    sheet.rows[ri]?.length ?? 0,
                                    c +
                                      Math.max(
                                        ...pasted.map((row) => row.length)
                                      )
                                  ),
                                },
                                (_, ci) => ({
                                  ...(sheet.rows[ri]?.[ci] ?? { value: "" }),
                                  ...(ri >= r &&
                                  ri < r + pasted.length &&
                                  ci >= c &&
                                  ci < c + pasted[ri - r].length
                                    ? { value: pasted[ri - r][ci - c] }
                                    : {}),
                                })
                              )
                          );
                          changeRows(rows);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="file-grid-pagination">
        <button disabled={page === 0} onClick={() => setRowPage(page - 1)}>
          Previous rows
        </button>
        <span>
          Rows {rowStart + 1}–{rowStart + visibleRows} of {rowCount}
        </span>
        <button
          disabled={rowStart + visibleRows >= rowCount}
          onClick={() => setRowPage(page + 1)}
        >
          Next rows
        </button>
      </div>
      <div
        className="file-sheet-tabs"
        role="tablist"
        aria-label="Workbook sheets"
      >
        {content.sheets.map((item, i) => (
          <button
            role="tab"
            aria-selected={i === index}
            key={item.id}
            onClick={() => {
              setSelectedSheet(i);
              setActive([0, 0]);
              setRowPage(0);
            }}
          >
            {item.name}
          </button>
        ))}
        <button
          disabled={readOnly || content.sheets.length >= 20}
          aria-label="Add sheet"
          onClick={() => {
            onChange({
              ...content,
              sheets: [
                ...content.sheets,
                {
                  id: crypto.randomUUID(),
                  name: `Sheet ${content.sheets.length + 1}`,
                  rows: [[{ value: "" }]],
                },
              ],
            });
            setSelectedSheet(content.sheets.length);
            setRowPage(0);
          }}
        >
          +
        </button>
        <button
          disabled={readOnly}
          onClick={() => {
            const name = window.prompt("Sheet name", sheet.name)?.trim();
            if (name)
              onChange({
                ...content,
                sheets: content.sheets.map((item, i) =>
                  i === index ? { ...item, name: name.slice(0, 31) } : item
                ),
              });
          }}
        >
          Rename sheet
        </button>
        <button
          disabled={readOnly || content.sheets.length < 2}
          onClick={() => {
            onChange({
              ...content,
              sheets: content.sheets.filter((_, i) => i !== index),
            });
            setSelectedSheet(Math.max(0, index - 1));
          }}
        >
          Delete sheet
        </button>
      </div>
      <p className="file-grid-hint">
        Formulas: SUM, AVERAGE, MIN, MAX, COUNT · arithmetic and cell references
        · paste tab-separated cells
      </p>
    </div>
  );
}
