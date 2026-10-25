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
function ensure(ok) { if (!ok) throw new Error('WorkbookLimit'); }
function position(ref) {
  const m = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(ref);
  ensure(m);
  let col = 0;
  for (const c of m[1]) col = col * 26 + c.charCodeAt(0) - 64;
  const row = Number(m[2]);
  ensure(col <= L.columns && row <= L.rows);
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
    ensure(++depth <= 64 && ++counts.nodes <= 200000);
    const attr = (key) => tag.attributes[key] && tag.attributes[key].value;
    const local = tag.local;
    if ((worksheet && local === 'c') || (name === 'xl/sharedStrings.xml' && local === 'si')) {
      stringDepth = depth; textLength = 0;
    }
    if (name === 'xl/workbook.xml' && local === 'sheet') ensure(++counts.sheets <= L.sheets);
    if (!worksheet) return;
    if (local === 'row') {
      ensure(++counts.rows <= L.rows);
      if (attr('r')) ensure(/^[1-9][0-9]*$/.test(attr('r')) && Number(attr('r')) <= L.rows);
    }
    if (local === 'c') { ensure(++counts.cells <= L.cells); if (attr('r')) position(attr('r')); }
    if (local === 'dimension' && attr('ref')) range(attr('ref'));
    if (local === 'mergeCell') { counts.merged += range(attr('ref') || ''); ensure(counts.merged <= L.cells); }
    if (local === 'col') {
      ensure(/^[1-9][0-9]*$/.test(attr('min') || '') && /^[1-9][0-9]*$/.test(attr('max') || ''));
      ensure(Number(attr('min')) <= Number(attr('max')) && Number(attr('max')) <= L.columns);
    }
  });
  const text = (value) => { if (stringDepth) { textLength += value.length; ensure(textLength <= L.cellCharacters); } };
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
          ensure(++counts.entries <= L.entries);
          const name = entry.fileName;
          ensure(!seen.has(name) && !name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..') && !name.split('/').includes('.'));
          seen.add(name);
          ensure(!(entry.generalPurposeBitFlag & 1) && [0, 8].includes(entry.compressionMethod));
          ensure(entry.uncompressedSize <= L.entryBytes);
          if (name.endsWith('/')) { zip.readEntry(); return; }
          const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, value) => error ? reject(error) : resolve(value)));
          const validator = /\.(xml|rels)$/.test(name) ? xmlValidator(name) : null;
          let bytes = 0;
          const chunks = [];
          for await (const chunk of stream) {
            bytes += chunk.length; counts.bytes += chunk.length;
            ensure(bytes <= L.entryBytes && counts.bytes <= L.expandedBytes);
            if (validator) validator.write(chunk);
            chunks.push(chunk);
          }
          if (validator) validator.close();
          rebuilt.file(name, Buffer.concat(chunks));
          zip.readEntry();
        })().catch(fail);
      });
      try { ensure(zip.entryCount <= L.entries); zip.readEntry(); } catch (error) { fail(error); }
    });
  });
  ensure(seen.has('[Content_Types].xml') && seen.has('xl/workbook.xml'));
  return rebuilt.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}
function cellToAmount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && 'result' in value) return cellToAmount(value.result);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Number(value.replace(/[,¥￥円\s]/g, '')); return Number.isFinite(n) ? n : null; }
  return null;
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
  ensure(buffer.length <= L.compressedBytes);
  const safe = await sanitize(buffer), wb = new ExcelJS.Workbook();
  await wb.xlsx.load(safe);
  ensure(wb.worksheets.length <= L.sheets);
  const sheets = [];
  let rowCount = 0;
  for (const ws of wb.worksheets) {
    let section = null, matched = false;
    const rows = [];
    ws.eachRow((row, rowNumber) => {
      const item = cellToText(row.getCell(2).value);
      ensure(item.length <= L.cellCharacters);
      if (/か月の収入/.test(item)) { section = 'income'; matched = true; return; }
      if (/か月の支出/.test(item)) { section = 'expense'; matched = true; return; }
      if (!section || item === '' || item === '項目' || item === '金額') return;
      ensure(++rowCount <= L.importRows);
      rows.push({ section, item, amount: cellToAmount(row.getCell(3).value), rowNumber });
    });
    if (matched) sheets.push({ sheet: ws.name, rows });
  }
  parentPort.postMessage({ ok: true, sheets });
})().catch(() => parentPort.postMessage({ ok: false }));
`;
