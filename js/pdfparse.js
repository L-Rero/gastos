/* Lectura LOCAL de extractos bancarios en PDF (el archivo nunca sale del móvil).
 * Usa pdf.js para obtener el texto con su posición y reconstruye las filas de la tabla.
 * Pensado para el formato habitual de los bancos españoles (Ibercaja y similares):
 *   FECHA  [FECHA VALOR]  CONCEPTO ……  IMPORTE  [SALDO]
 * Si el importe no lleva signo, se deduce por la columna (Debe/Haber) o por la variación del saldo. */
const PDFP = (() => {
  let loaded = null;
  const load = () => loaded || (loaded = new Promise((res, rej) => {
    if (window.pdfjsLib) return res();
    const s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
    s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(); };
    s.onerror = () => { loaded = null; rej(new Error('No se pudo cargar el lector de PDF')); };
    document.head.appendChild(s);
  }));

  const RX_DATE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/;
  const RX_AMT = /^([-+−]?)\s?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})\s?([-+−]?)(?:\s?(?:€|EUR|D|H))?$/i;
  const SKIP = /saldo\s+(anterior|inicial)|suma\s+y\s+sigue|total(es)?\s+(movimientos|cargos|abonos)|p[aá]gina\s+\d|iban|bic|titular/i;

  const toDate = m => { let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; d = +d; mo = +mo;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
  const toAmt = s => { const m = String(s).trim().match(RX_AMT); if (!m) return null;
    const v = +(m[2].replace(/\./g, '') + '.' + m[3]); const neg = /[-−]/.test(m[1] + m[4]); const sgn = /[-+−]/.test(m[1] + m[4]) || /\s?D$/i.test(s) || /\s?H$/i.test(s);
    return { v: neg || /\s?D$/i.test(s) ? -v : v, signed: sgn }; };

  async function lines(file, password) {
    await load();
    const data = new Uint8Array(await file.arrayBuffer());
    let doc;
    try { doc = await pdfjsLib.getDocument({ data, password, isEvalSupported: false }).promise; }
    catch (e) { if (e && e.name === 'PasswordException') throw { code: 'password', retry: e.code === 2 }; throw e; }
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 8, s: i.str.replace(/\s+/g, ' ').trim() }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows = [];
      for (const it of items) {
        const r = rows.find(r => Math.abs(r.y - it.y) <= Math.max(2.5, it.h * 0.35));
        if (r) r.c.push(it); else rows.push({ y: it.y, h: it.h, c: [it] });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.c.sort((a, b) => a.x - b.x);
        // une fragmentos muy próximos (pdf.js a veces parte palabras)
        const cells = [];
        for (const it of r.c) { const l = cells[cells.length - 1]; if (l && it.x - (l.x + l.w) < 1.2) { l.s += it.s; l.w = it.x + it.w - l.x; } else cells.push({ ...it }); }
        out.push({ page: p, y: r.y, h: r.h, cells });
      }
    }
    return out;
  }

  function parse(L) {
    // Cabecera: posiciones de columnas Debe/Haber (si existen)
    let colD = null, colH = null;
    for (const l of L) for (const c of l.cells) {
      if (/^(debe|cargos?|reintegros?)$/i.test(c.s)) colD = c.x + c.w / 2;
      if (/^(haber|abonos?|ingresos?)$/i.test(c.s)) colH = c.x + c.w / 2;
    }
    const rows = []; let opening = null, last = null;
    for (const l of L) {
      const txt = l.cells.map(c => c.s).join(' ');
      if (/saldo\s+(anterior|inicial)/i.test(txt)) { const a = [...l.cells].reverse().map(c => toAmt(c.s)).find(Boolean); if (a && opening == null) opening = a.v; last = null; continue; }
      // separa celdas que contienen fecha + texto pegados
      const cells = [];
      for (const c of l.cells) {
        const m = c.s.match(/^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+)$/);
        if (m) { cells.push({ ...c, s: m[1] }); cells.push({ ...c, x: c.x + 1, s: m[2] }); } else cells.push(c);
      }
      const dm = cells.length && cells[0].s.match(RX_DATE);
      if (!dm) {
        // línea de continuación del concepto
        if (last && !SKIP.test(txt) && Math.abs(last.y - l.y) < last.h * 2.6 && last.page === l.page && last.extra < 2 && !cells.some(c => toAmt(c.s))) {
          last.row.concept += ' ' + txt; last.extra++; last.y = l.y;
        } else last = null;
        continue;
      }
      const date = toDate(dm); if (!date) { last = null; continue; }
      let rest = cells.slice(1);
      if (rest[0] && RX_DATE.test(rest[0].s)) rest = rest.slice(1); // fecha valor
      const amts = [];
      while (rest.length && amts.length < 2) { const a = toAmt(rest[rest.length - 1].s); if (!a) break; amts.unshift({ ...a, x: rest[rest.length - 1].x + rest[rest.length - 1].w / 2 }); rest.pop(); }
      // una fecha valor puede quedar justo antes del importe
      while (rest.length && RX_DATE.test(rest[rest.length - 1].s)) rest.pop();
      if (!amts.length) { last = null; continue; }
      const concept = rest.map(c => c.s).join(' ').replace(/\s+/g, ' ').trim();
      if (SKIP.test(concept)) { last = null; continue; }
      const imp = amts[0], bal = amts.length > 1 ? amts[1].v : null;
      const row = { date, concept: concept || '(sin concepto)', abs: Math.abs(imp.v), amount: imp.signed ? imp.v : null, bal, x: imp.x };
      if (row.amount == null && colD != null && colH != null) row.amount = Math.abs(imp.x - colD) < Math.abs(imp.x - colH) ? -row.abs : row.abs;
      rows.push(row); last = { row, y: l.y, h: l.h, page: l.page, extra: 0 };
    }
    if (!rows.length) return { rows, bal: null, balDate: null };
    // orden del extracto: ascendente o descendente
    const desc = rows[0].date > rows[rows.length - 1].date;
    const chrono = desc ? [...rows].reverse() : rows;
    // signo deducido por el saldo cuando no viene en el PDF
    if (chrono.some(r => r.amount == null)) {
      let prev = opening;
      chrono.forEach(r => {
        if (r.amount == null && r.bal != null && prev != null)
          r.amount = Math.abs(prev + r.abs - r.bal) < Math.abs(prev - r.abs - r.bal) ? r.abs : -r.abs;
        if (r.bal != null) prev = r.bal;
      });
      chrono.forEach(r => { if (r.amount == null) { r.amount = -r.abs; r.guess = true; } });
    }
    const lastR = chrono[chrono.length - 1];
    return { rows: chrono.map(r => ({ date: r.date, concept: r.concept, amount: Math.round(r.amount * 100) / 100, guess: !!r.guess })), bal: lastR.bal, balDate: lastR.bal != null ? lastR.date : null };
  }

  async function read(file, password) {
    const L = await lines(file, password);
    const text = L.map(l => l.cells.map(c => c.s).join('  ')).join('\n');
    if (text.replace(/\s/g, '').length < 40) throw { code: 'scanned' };
    return Object.assign(parse(L), { text });
  }
  return { read, parse, toAmt, toDate };
})();
