/* Núcleo: estado, cálculos, guardado local cifrado y sincronización cifrada con el hogar. */
const MS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CAT0 = [['Alquileres/hipoteca','g',[]],['Gastos fijos','g',['Suscripciones/pagos mensuales','Coche/transporte']],['Gastos suministro','g',['Luz','Gas','Agua','Basuras y otros']],['Compras','g',['Supermercado','Cafés/snacks','Ropa','Compras Internet','Mascotas','Retirada de efectivo']],['Ocio','g',['Cenas','Compras','Otros']],['Ingresos','i',['Salario','Otros ingresos']]].map(([n,t,s])=>({n,t,s}));
const COL = ['#0A84FF','#BF5AF2','#30D158','#FF9F0A','#FF375F','#64D2FF','#5E5CE6','#FFD60A','#AC8E68','#8E8E93'];
const blank = () => ({ v:2, acc:[], cats:JSON.parse(JSON.stringify(CAT0)), catsU:0, tx:[], rules:{}, plan:[], nts:[], del:{}, cfg:{ base: today() }, cfgU:0 });
let S = blank();

const norm = c => String(c||'').toUpperCase().replace(/[0-9\/\-\.\*#]+/g,' ').replace(/\s+/g,' ').trim();

/* ───── Migración de copias del prototipo (artefacto) ───── */
function migrate(o) {
  const n = blank(), now = Date.now();
  n.acc = (o.acc||[]).map(a => ({ id: a.id||uid(), name: String(a.name||'Cuenta'), bal: +a.bal||0, hid: !!a.hid, res: +a.res||0, bd: a.bd||'', snaps: a.snaps||[], u: a.u||now }));
  n.cats = Array.isArray(o.cats) && o.cats.length ? o.cats : n.cats; n.catsU = o.catsU||now;
  n.tx = (o.tx||[]).filter(t => t && t.date).map(t => ({ id: t.id||uid(), date: t.date, concept: String(t.concept||''), amount: +t.amount||0, acc: t.acc||'', cat: t.cat||'', sub: t.sub||'', note: t.note||'', tr: t.tr?1:0, u: t.u||now }));
  n.plan = (o.plan||[]).map(p => Object.assign({}, p, { id: p.id||uid(), u: p.u||now }));
  n.nts = (o.nts||[]).map(x => ({ id: x.id||uid(), title: x.title||'', body: x.body||'', pin: !!x.pin, created: x.created||now, u: x.u||x.updated||now }));
  Object.keys(o.rules||{}).forEach(k => { const r = o.rules[k]; if (r && r.cat) n.rules[k] = { cat: r.cat, sub: r.sub||'', u: r.u||now }; });
  n.del = o.v === 2 && o.del ? o.del : {};
  // El prototipo contaba los movimientos posteriores a una fecha base fija
  n.cfg = o.v === 2 && o.cfg ? o.cfg : { base: '2026-09-30' }; n.cfgU = o.cfgU||now;
  return n;
}

/* ───── Detección automática de cambios (para sincronizar sin conflictos) ───── */
const CACHE = new Map();
function lists(s) { return [s.acc, s.tx, s.plan, s.nts]; }
function rebase() {
  CACHE.clear();
  lists(S).forEach(L => L.forEach(x => CACHE.set(x.id, noU(x))));
  Object.keys(S.rules).forEach(k => CACHE.set('r:'+k, noU(S.rules[k])));
  CACHE.set('#cats', JSON.stringify(S.cats)); CACHE.set('#cfg', JSON.stringify(S.cfg));
}
function stamp() {
  const now = Date.now(), seen = new Set(['#cats', '#cfg']);
  lists(S).forEach(L => L.forEach(x => {
    if (!x.id) x.id = uid(); seen.add(x.id); const j = noU(x);
    if (CACHE.get(x.id) !== j || S.del[x.id] || !x.u) { x.u = now; delete S.del[x.id]; CACHE.set(x.id, j); }
  }));
  Object.keys(S.rules).forEach(k => {
    const r = S.rules[k], key = 'r:'+k, j = noU(r); seen.add(key);
    if (CACHE.get(key) !== j || S.del[key] || !r.u) { r.u = now; delete S.del[key]; CACHE.set(key, j); }
  });
  const cj = JSON.stringify(S.cats); if (CACHE.get('#cats') !== cj) { S.catsU = now; CACHE.set('#cats', cj); }
  const fj = JSON.stringify(S.cfg); if (CACHE.get('#cfg') !== fj) { S.cfgU = now; CACHE.set('#cfg', fj); }
  for (const k of [...CACHE.keys()]) if (!seen.has(k)) { S.del[k] = now; CACHE.delete(k); }
  // olvida borrados de hace más de 400 días
  const old = now - 400 * 864e5; Object.keys(S.del).forEach(k => { if (S.del[k] < old) delete S.del[k]; });
}
function merge(L, R) {
  const del = Object.assign({}, L.del);
  Object.keys(R.del||{}).forEach(k => { if (!(del[k] >= R.del[k])) del[k] = R.del[k]; });
  const rules = {};
  [L.rules, R.rules||{}].forEach(src => Object.keys(src).forEach(k => { const r = src[k]; if (!rules[k] || (r.u||0) > (rules[k].u||0)) rules[k] = r; }));
  Object.keys(rules).forEach(k => { if (del['r:'+k] >= (rules[k].u||0)) delete rules[k]; });
  const rc = R.catsU && R.catsU > (L.catsU||0), rf = R.cfgU && R.cfgU > (L.cfgU||0);
  return { v: 2, acc: mergeList(L.acc, R.acc, del), tx: mergeList(L.tx, R.tx, del), plan: mergeList(L.plan, R.plan, del), nts: mergeList(L.nts, R.nts, del),
    rules, del, cats: rc ? R.cats : L.cats, catsU: rc ? R.catsU : L.catsU, cfg: rf ? R.cfg : L.cfg, cfgU: rf ? R.cfgU : L.cfgU };
}
function docsOf(s, known) {
  const d = { meta: { acc: [...s.acc].sort(byId), cats: s.cats, catsU: s.catsU, rules: s.rules, del: s.del, cfg: s.cfg, cfgU: s.cfgU },
    plan: { items: [...s.plan].sort(byId) }, notes: { items: [...s.nts].sort(byId) } };
  const by = {}; s.tx.forEach(t => { const k = 'tx-' + String(t.date||'0000').slice(0,4); (by[k] = by[k] || []).push(t); });
  Object.keys(known||{}).forEach(k => { if (k.startsWith('tx-') && !by[k]) by[k] = []; });
  Object.keys(by).forEach(k => d[k] = { items: by[k].sort(byId) });
  return d;
}
function fromDocs(p) {
  const r = { acc: [], tx: [], plan: [], nts: [], rules: {}, del: {}, cats: null, catsU: 0, cfg: null, cfgU: 0 };
  if (p.meta) Object.assign(r, { acc: p.meta.acc||[], cats: p.meta.cats, catsU: p.meta.catsU||0, rules: p.meta.rules||{}, del: p.meta.del||{}, cfg: p.meta.cfg, cfgU: p.meta.cfgU||0 });
  if (p.plan) r.plan = p.plan.items||[];
  if (p.notes) r.nts = p.notes.items||[];
  Object.keys(p).filter(k => k.startsWith('tx-')).forEach(k => r.tx = r.tx.concat(p[k].items||[]));
  return r;
}


/* ───── Cálculos (portados del prototipo y generalizados) ───── */
const Y0 = new Date().getFullYear(), cm = new Date().getMonth();
const eur = n => (n||0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = n => (n||0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const base = () => (S.cfg && S.cfg.base) || '0000-00-00';
const isHid = a => !!a.hid;
const hidAcc = id => { const a = S.acc.find(x => x.id === id); return !!a && isHid(a); };
const txY = y => S.tx.filter(t => t.date.startsWith(String(y)));
const real = y => { const a = Array.from({ length: 12 }, () => ({ i: 0, g: 0, c: {} })); txY(y).forEach(t => { if (t.tr || hidAcc(t.acc)) return; const m = +t.date.slice(5,7) - 1, v = t.amount; if (v > 0) a[m].i += v; else { a[m].g -= v; const k = t.cat || 'Sin categoría'; a[m].c[k] = (a[m].c[k]||0) - v; } }); return a; };
const nm = p => p.end ? Math.max(1, (+p.end.slice(0,4))*12 + +p.end.slice(5,7) - (+p.start.slice(0,4))*12 - +p.start.slice(5,7) + 1) : 1;
const pit = (p, y, m) => { const sy = +p.start.slice(0,4), s = sy*12 + +p.start.slice(5,7) - 1, k = y*12 + m; if (k < s || (p.end && k > (+p.end.slice(0,4))*12 + +p.end.slice(5,7) - 1)) return 0; if (p.freq==='m'||p.freq==='p'||p.freq==='s'||(p.freq==='d'&&p.end)||(p.freq==='y'&&(k-s)%12===0)||(p.freq==='o'&&k===s)) return p.amount*(p.freq==='p'&&(m===5||m===11)?2:1)/(p.freq==='s'?12:p.freq==='d'?nm(p):1)*Math.pow(1+(p.freq==='d'?0:(p.inc||0))/100, y-sy); return 0; };
const pm = (y, m) => { let i = 0, g = 0; S.plan.forEach(p => { const a = pit(p, y, m); p.t === 'i' ? i += a : g += a; }); return { i, g }; };
const pan = (p, y) => Array.from({ length: 12 }, (_, m) => pit(p, y, m)).reduce((a, x) => a + x, 0);
const accFrom = a => a.bd || base();
const accAt = (a, end) => { const sn = (a.snaps||[]).filter(s => s.d <= end).pop(), from = sn ? sn.d : accFrom(a); return (sn ? +sn.b : +a.bal||0) + S.tx.filter(t => t.acc === a.id && t.date > from && t.date <= end).reduce((x, t) => x + t.amount, 0); };
const unas = end => S.tx.filter(t => !t.tr && !S.acc.some(a => a.id === t.acc) && t.date > base() && t.date <= end).reduce((x, t) => x + t.amount, 0);
const wealthAll = end => S.acc.reduce((x, a) => x + accAt(a, end), 0) + unas(end);
const wealthAt = end => S.acc.filter(c => !isHid(c)).reduce((x, a) => x + accAt(a, end), 0) + unas(end);
const cur = () => wealthAt('9999-12-31');
const rnet = y => real(y).reduce((a, m) => a + m.i - m.g, 0);
const pnet = y => Array.from({ length: 12 }, (_, m) => pm(y, m)).reduce((a, m) => a + m.i - m.g, 0);
function closeY(y) { if (y < Y0) return openY(y + 1); if (y === Y0) { const lm = Math.max(-1, ...S.tx.filter(t => t.date.startsWith(String(y)) && !t.tr && !hidAcc(t.acc)).map(t => +t.date.slice(5,7) - 1)); return cur() + Array.from({ length: 11 - lm }, (_, k) => pm(y, lm + 1 + k)).reduce((a, m) => a + m.i - m.g, 0); } return closeY(y - 1) + pnet(y); }
function openY(y) { if (y === Y0) return cur() - rnet(y); if (y > Y0) return closeY(y - 1); return openY(y + 1) - rnet(y); }
const ryrs = () => [...new Set(S.tx.filter(t => !t.tr && !hidAcc(t.acc)).map(t => +t.date.slice(0,4)))].sort((a, b) => a - b);

/* Similitud entre conceptos (0 a 1), ignorando números y signos. Se exige ≥ 0,9 para categorizar solo. */
const lev = (a, b) => { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n); let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j-1] + 1, p[j-1] + (a[i-1] === b[j-1] ? 0 : 1)); p = c; } return p[n]; };
const SIM_MIN = 0.9;
const simNorm = (k, n) => { if (k === n) return 1; if (!k || !n || Math.abs(n.length - k.length) > Math.ceil(Math.max(n.length, k.length) * .1)) return 0; return 1 - lev(k, n) / Math.max(n.length, k.length); };
const simConcept = (a, b) => simNorm(norm(a), norm(b));
function matchCat(concept, sign) {
  const k = norm(concept); if (!k) return null;
  const seen = new Map();
  Object.keys(S.rules).forEach(r => { const v = S.rules[r]; if (v && v.cat) seen.set(r, { cat: v.cat, sub: v.sub||'', from: r }); });
  S.tx.forEach(t => { if (t.cat && t.concept && (sign == null || (t.amount > 0) === (sign > 0))) { const n = norm(t.concept); if (n && !seen.has(n)) seen.set(n, { cat: t.cat, sub: t.sub||'', from: t.concept }); } });
  if (seen.has(k)) return Object.assign({ sim: 1 }, seen.get(k));
  let best = null, bs = 0;
  seen.forEach((v, n) => { const x = simNorm(k, n); if (x > bs) { bs = x; best = v; } });
  return best && bs >= SIM_MIN ? Object.assign({ sim: bs }, best) : null;
}
