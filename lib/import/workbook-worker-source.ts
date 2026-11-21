// 固定コードのみを実行し、入力バイト列はworkerDataで渡す。
// Node.jsで解決した実パスを呼び出し側から受け取り、バンドラー内部の識別子を使わない。
export const WORKBOOK_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { StringDecoder } = require('node:string_decoder');
const ExcelJS = require(workerData.modules.exceljs);
const yauzl = require(workerData.modules.yauzl);
const { SaxesParser } = require(workerData.modules.saxes);
const JSZip = require(workerData.modules.jszip);
const L = workerData.limits;
const counts = { bytes: 0, entries: 0, sheets: 0, rows: 0, cells: 0, nodes: 0, merged: 0 };
function ensure(ok) { if (!ok) throw new Error('InvalidWorkbook'); }
function limit(ok) { if (!ok) throw new Error('WorkbookLimit'); }
function position(ref) {
  const m = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(ref);
  ensure(m);
  let col = 0;
  for (const c of m[1]) col = col * 26 + c.charCodeAt(0) - 64;
  const row = Number(m[2]);
  limit(col <= L.columns && row <= L.rows);
  return { col, row };
}
function range(ref) {
  const parts = ref.split(':');
  ensure(parts.length <= 2);
  const a = position(parts[0]), b = position(parts[1] || parts[0]);
  ensure(b.col >= a.col && b.row >= a.row);
  return (b.col - a.col + 1) * (b.row - a.row + 1);
}
function xmlValidator(name) {
  const parser = new SaxesParser({ xmlns: true });
  const worksheet = /^xl\/worksheets\/[^/]+\.xml$/.test(name);
  let depth = 0, textLength = 0, stringDepth = 0;
  parser.on('doctype', () => { throw new Error('DoctypeForbidden'); });
  parser.on('error', (error) => { throw error; });
  parser.on('opentag', (tag) => {
    limit(++depth <= 64 && ++counts.nodes <= 200000);
    const attr = (key) => tag.attributes[key] && tag.attributes[key].value;
    const local = tag.local;
    if ((worksheet && local === 'c') || (name === 'xl/sharedStrings.xml' && local === 'si')) {
      stringDepth = depth; textLength = 0;
    }
    if (name === 'xl/workbook.xml' && local === 'sheet') limit(++counts.sheets <= L.sheets);
    if (!worksheet) return;
    if (local === 'row') {
      limit(++counts.rows <= L.rows);
      if (attr('r')) ensure(/^[1-9][0-9]*$/.test(attr('r')) && Number(attr('r')) <= L.rows);
    }
    if (local === 'c') { limit(++counts.cells <= L.cells); if (attr('r')) position(attr('r')); }
    if (local === 'dimension' && attr('ref')) range(attr('ref'));
    if (local === 'mergeCell') { counts.merged += range(attr('ref') || ''); limit(counts.merged <= L.cells); }
    if (local === 'col') {
      ensure(/^[1-9][0-9]*$/.test(attr('min') || '') && /^[1-9][0-9]*$/.test(attr('max') || ''));
      ensure(Number(attr('min')) <= Number(attr('max')) && Number(attr('max')) <= L.columns);
    }
  });
  const text = (value) => { if (stringDepth) { textLength += value.length; limit(textLength <= L.cellCharacters); } };
  parser.on('text', text); parser.on('cdata', text);
  parser.on('closetag', () => { if (depth === stringDepth) stringDepth = 0; depth--; });
  const decoder = new StringDecoder('utf8');
  return { write(chunk) { parser.write(decoder.write(chunk)); }, close() { parser.write(decoder.end()).close(); } };
}
async function sanitize(buffer) {
  const rebuilt = new JSZip(), seen = new Set();
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      const fail = (error) => { zip.close(); reject(error); };
      zip.on('error', fail); zip.on('end', resolve);
      zip.on('entry', (entry) => {
        (async () => {
          limit(++counts.entries <= L.entries);
          const name = entry.fileName;
          ensure(!seen.has(name) && !name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..') && !name.split('/').includes('.'));
          seen.add(name);
          ensure(!(entry.generalPurposeBitFlag & 1) && [0, 8].includes(entry.compressionMethod));
          limit(entry.uncompressedSize <= L.entryBytes);
          if (name.endsWith('/')) { zip.readEntry(); return; }
          const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, value) => error ? reject(error) : resolve(value)));
          const validator = /\.(xml|rels)$/.test(name) ? xmlValidator(name) : null;
          let bytes = 0;
          const chunks = [];
          for await (const chunk of stream) {
            bytes += chunk.length; counts.bytes += chunk.length;
            limit(bytes <= L.entryBytes && counts.bytes <= L.expandedBytes);
            if (validator) validator.write(chunk);
            chunks.push(chunk);
          }
          if (validator) validator.close();
          rebuilt.file(name, Buffer.concat(chunks));
          zip.readEntry();
        })().catch(fail);
      });
      try { limit(zip.entryCount <= L.entries); zip.readEntry(); } catch (error) { fail(error); }
    });
  });
  ensure(seen.has('[Content_Types].xml') && seen.has('xl/workbook.xml'));
  return rebuilt.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}
function readCell(cell) {
  const value = cell.value;
  if (value && typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) {
      if (value.result == null) return { issue: { cell: cell.address, reason: '数式の計算結果が保存されていません' } };
      if (typeof value.result === 'object' && 'error' in value.result)
        return { issue: { cell: cell.address, reason: '数式の計算結果がエラーです' } };
      return { value: value.result };
    }
    if ('error' in value) return { issue: { cell: cell.address, reason: 'Excelのエラー値です' } };
  }
  return { value };
}
function readAmount(cell) {
  const { value, issue } = readCell(cell);
  if (issue) return { amount: null, issue };
  if (value == null || value === '') return { amount: null };
  if (typeof value === 'number' && Number.isFinite(value)) return { amount: value };
  if (typeof value === 'string') {
    const normalized = value.replace(/[,¥￥円\s]/g, '');
    if (/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(normalized) && Number.isFinite(Number(normalized)))
      return { amount: Number(normalized) };
  }
  return { amount: null, issue: { cell: cell.address, reason: '金額の値を読み取れません' } };
}
function readDate(cell, date1904) {
  const { value, issue } = readCell(cell);
  if (issue) return { issue };
  if (value == null || value === '') return {};
  let date = typeof value === 'string' ? value.trim() : '';
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    date = value.toISOString().slice(0, 10);
    // ExcelJS は1900年方式で1899-12-30を起点に変換する。
    // Excelの架空のうるう日より前は1日繰り上げ、シリアル値60は拒否する。
    if (!date1904 && date === '1900-02-28') {
      return { issue: { cell: cell.address, reason: 'Excelの1900-02-29は存在しない日付です' } };
    }
    if (!date1904 && date >= '1899-12-31' && date < '1900-02-28') {
      date = new Date(value.getTime() + 86_400_000).toISOString().slice(0, 10);
    }
  }
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) && !date.startsWith('0000-')) {
    const parsed = new Date(date + 'T00:00:00Z');
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) return { date };
  }
  return { issue: { cell: cell.address, reason: '実在する日付を YYYY-MM-DD 形式で入力してください' } };
}
function cellToText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('result' in value) return cellToText(value.result);
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim();
    if ('text' in value) return String(value.text).trim();
  }
  return String(value).trim();
}
(async () => {
  const buffer = Buffer.from(workerData.buffer);
  limit(buffer.length <= L.compressedBytes);
  const safe = await sanitize(buffer), wb = new ExcelJS.Workbook();
  await wb.xlsx.load(safe);
  limit(wb.worksheets.length <= L.sheets);
  const sheets = [];
  let rowCount = 0;
  for (const ws of wb.worksheets) {
    let section = null, matched = false, dateColumn = null;
    const rows = [];
    ws.eachRow((row, rowNumber) => {
      const itemCell = row.getCell(2);
      const item = cellToText(itemCell.value);
      limit(item.length <= L.cellCharacters);
      if (/か月の収入/.test(item)) { section = 'income'; matched = true; dateColumn = null; return; }
      if (/か月の支出/.test(item)) { section = 'expense'; matched = true; dateColumn = null; return; }
      if (!section) return;
      if (item === '項目' || item === '金額') {
        if (item === '項目') {
          dateColumn = null;
          row.eachCell((cell, column) => {
            if (dateColumn === null && column > 3 && cellToText(cell.value) === '日付') dateColumn = column;
          });
        }
        return;
      }
      const itemIssue = readCell(itemCell).issue;
      const amountCell = row.getCell(3);
      const money = readAmount(amountCell);
      if (item === '' && money.amount == null && !itemIssue && !money.issue) return;
      limit(++rowCount <= L.importRows);
      const dated = dateColumn === null ? {} : readDate(row.getCell(dateColumn), wb.properties.date1904);
      const issue = itemIssue || money.issue || dated.issue;
      rows.push({
        section, item: itemIssue ? '' : item, amount: money.amount, rowNumber,
        cell: item ? amountCell.address : itemCell.address, ...(dated.date ? { date: dated.date } : {}),
        ...(issue ? { issue } : {}),
      });
    });
    if (matched) sheets.push({ sheet: ws.name, rows });
  }
  parentPort.postMessage({ ok: true, sheets });
})().catch((error) => parentPort.postMessage({ ok: false, limit: error.message === 'WorkbookLimit' }));
`;
