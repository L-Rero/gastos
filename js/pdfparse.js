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

  // Fechas con el mes en letras, como en los extractos de Ibercaja: «30 sep.», «02 ene.» (sin año)
  const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
  const RX_MDATE = /^(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?(?:\s+(\d{4}))?$/i;
  const isDate = s => RX_DATE.test(s) || RX_MDATE.test(s);
  /* devuelve {d, m, y} (y puede ser null si el PDF no indica el año) */
  const dateOf = s => {
    let m = s.match(RX_DATE), d, mo, y = null;
    if (m) { d = +m[1]; mo = +m[2]; y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; }
    else if ((m = s.match(RX_MDATE))) { d = +m[1]; mo = MESES[m[2].toLowerCase()]; y = m[3] ? +m[3] : null; }
    else return null;
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? { d, m: mo, y } : null;
  };
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const toDate = m => { const r = dateOf(m[0]); return r && r.y ? iso(r.y, r.m, r.d) : null; };
  /* Año de referencia: el periodo del extracto («de 01/09/2026 a 30/09/2026») o la fecha completa más reciente */
  function yearResolver(L) {
    const all = L.map(l => l.cells.map(c => c.s).join(' ')).join('\n'), F = '(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})';
    const per = all.match(new RegExp(F + '\\s*(?:a|al|hasta|-|–)\\s*' + F, 'i'));
    let start = null, end = null;
    if (per) { start = iso(+per[3], +per[2], +per[1]); end = iso(+per[6], +per[5], +per[4]); }
    else { const full = [...all.matchAll(new RegExp(F, 'g'))].map(x => iso(+x[3], +x[2], +x[1])).sort(); end = full.pop() || new Date().toISOString().slice(0, 10); }
    const eY = +end.slice(0, 4), eM = +end.slice(5, 7);
    return (d, m) => {
      if (start) for (let y = eY; y >= +start.slice(0, 4); y--) { const c = iso(y, m, d); if (c >= start && c <= end) return c; }
      return iso(m <= eM ? eY : eY - 1, m, d);
    };
  }
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
    const rows = [], yr = yearResolver(L); let opening = null, last = null;
    for (const l of L) {
      const txt = l.cells.map(c => c.s).join(' ');
      if (/saldo\s+(anterior|inicial)/i.test(txt)) { const a = [...l.cells].reverse().map(c => toAmt(c.s)).find(Boolean); if (a && opening == null) opening = a.v; last = null; continue; }
      // separa celdas que contienen fecha + texto pegados
      const cells = [];
      for (const c of l.cells) {
        const m = c.s.match(/^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+)$/);
        if (m) { cells.push({ ...c, s: m[1] }); cells.push({ ...c, x: c.x + 1, s: m[2] }); } else cells.push(c);
      }
      const dm = cells.length && dateOf(cells[0].s);
      if (!dm) {
        // línea de continuación del concepto
        if (last && !SKIP.test(txt) && Math.abs(last.y - l.y) < last.h * 2.6 && last.page === l.page && last.extra < 2 && !cells.some(c => toAmt(c.s))) {
          last.row.concept += ' ' + txt; last.extra++; last.y = l.y;
        } else last = null;
        continue;
      }
      const date = dm.y ? iso(dm.y, dm.m, dm.d) : yr(dm.d, dm.m);
      let rest = cells.slice(1);
      if (rest[0] && isDate(rest[0].s)) rest = rest.slice(1); // fecha valor
      const amts = [];
      while (rest.length && amts.length < 2) { const a = toAmt(rest[rest.length - 1].s); if (!a) break; amts.unshift({ ...a, x: rest[rest.length - 1].x + rest[rest.length - 1].w / 2 }); rest.pop(); }
      // una fecha valor puede quedar justo antes del importe
      while (rest.length && isDate(rest[rest.length - 1].s)) rest.pop();
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
    const minusMarked = chrono.some(r => r.amount != null && r.amount < 0);
    // signo deducido por el saldo cuando no viene en el PDF
    if (chrono.some(r => r.amount == null)) {
      let prev = opening;
      chrono.forEach(r => {
        if (r.amount == null && r.bal != null && prev != null)
          r.amount = Math.abs(prev + r.abs - r.bal) < Math.abs(prev - r.abs - r.bal) ? r.abs : -r.abs;
        if (r.bal != null) prev = r.bal;
      });
      // si el extracto marca los cargos con «−» (caso de Ibercaja), lo que no lleva signo es un abono
      chrono.forEach(r => { if (r.amount == null) { if (minusMarked) r.amount = r.abs; else { r.amount = -r.abs; r.guess = true; } } });
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
