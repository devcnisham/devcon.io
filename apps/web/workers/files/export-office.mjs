/** Revision JSON -> Office output. Only trusted Python worker invokes this helper. */
import fs from 'node:fs/promises';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';

const [input, output] = process.argv.slice(2);
const content = JSON.parse(await fs.readFile(input, 'utf8'));
const allowedFormula = value => {
  if (!/^=[A-Z0-9$+\-*/^().,:\s]+$/i.test(value)) return false;
  if ([...value.matchAll(/([A-Z]+)\s*\(/gi)].some(match => !['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'].includes(match[1].toUpperCase()))) return false;
  return !/[A-Z]/i.test(value.slice(1).replace(/(?:SUM|AVERAGE|MIN|MAX|COUNT)\s*\(/gi, '(').replace(/\$?[A-Z]{1,3}\$?[1-9][0-9]*\b/gi, '1'));
};
if (content.kind === 'presentation') {
  const deck = new PptxGenJS();
  deck.layout = 'LAYOUT_WIDE';
  deck.author = 'DevCon';
  deck.subject = 'Exported from a saved DevCon revision';
  deck.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-US' };
  const themes = { midnight: { background: '151C2F', text: 'F3F6FF', accent: 'A8BFFF' }, paper: { background: 'FFFFFF', text: '192333', accent: '376D95' }, ocean: { background: 'E8F4F7', text: '123E4F', accent: '16758D' } };
  const theme = themes[content.theme] ?? themes.paper;
  for (const item of content.slides) {
    const slide = deck.addSlide();
    slide.background = { color: theme.background };
    slide.addShape(deck.ShapeType.rect, { x: 0.55, y: 0.5, w: 0.1, h: 0.5, fill: { color: theme.accent }, line: { color: theme.accent } });
    slide.addText(String(item.title ?? ''), { x: 0.8, y: item.layout === 'title' ? 2 : 0.6, w: 11.7, h: 1.1, fontFace: 'Aptos Display', fontSize: item.layout === 'title' ? 36 : 28, bold: true, color: theme.text, breakLine: false, fit: 'shrink', valign: 'mid' });
    slide.addText(String(item.body ?? ''), { x: 0.8, y: item.layout === 'title' ? 3.3 : 2, w: item.layout === 'split' ? 5.8 : 11.7, h: item.layout === 'title' ? 2.2 : 4.8, fontSize: 20, color: theme.text, valign: 'top', breakLine: false, fit: 'shrink' });
    if (typeof item._imageData === 'string' && /^image\/(png|jpeg);base64,/.test(item._imageData)) {
      slide.addImage({ data: item._imageData, x: Number.isFinite(item.x) ? Math.max(0, Math.min(66, item.x)) * 13.333 / 100 : 7.5, y: Number.isFinite(item.y) ? Math.max(0, Math.min(60, item.y)) * 7.5 / 100 : 2, w: 4.5, h: 3 });
    }
  }
  await deck.writeFile({ fileName: output });
} else if (content.kind === 'spreadsheet') {
  const book = XLSX.utils.book_new();
  for (const [index, sheet] of content.sheets.entries()) {
    const rows = sheet.rows.map(row => row.map(cell => {
      const value = String(cell.value ?? '');
      if (value.startsWith('=') && allowedFormula(value)) return { t: 'n', f: value.slice(1) };
      if (value.trim() !== '' && Number.isFinite(Number(value)) && cell.format !== 'text') return Number(value);
      return value;
    }));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = Array.from({ length: Math.max(1, ...rows.map(row => row.length)) }, () => ({ wch: 20 }));
    let name = String(sheet.name || `Sheet ${index + 1}`).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31);
    const baseName = name;
    let suffix = 1;
    while (book.SheetNames.includes(name)) name = `${baseName.slice(0, 26)} ${suffix++}`;
    XLSX.utils.book_append_sheet(book, worksheet, name);
  }
  await fs.writeFile(output, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
} else {
  throw new Error('Unsupported Office content');
}
