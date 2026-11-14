/* Interfaz: vistas portadas del prototipo, sin datos personales ni dependencias de Claude. */
const $ = s => document.querySelector(s), M = () => document.getElementById('m');
let Y = Y0, V = 'panel', H = 5, Q = '', charts = [], imp = null, lastPdfText = '';
const pad2 = n => String(n).padStart(2, '0');
const toast = (m, ms) => { const e = $('#ts'); if (!e) return; e.textContent = m; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, ms || 3500); };
const tgl = k => { const e = $('#n' + k); if (e) e.hidden = !e.hidden; };
const color = n => { const i = S.cats.findIndex(c => c.n === n), c = S.cats[i]; return c && /^#[0-9a-f]{6}$/i.test(c.col||'') ? c.col : COL[Math.max(0, i) % COL.length]; };
const color_ = n => S.cats.some(c => c.n === n) ? color(n) : '#8E8E93';
const ink = h => { const n = parseInt(String(h).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r*299 + g*587 + b*114) / 1000 > 175 ? '#1C1C1E' : '#fff'; };
const subColor = (cn, sn) => { const c = S.cats.find(x => x.n === cn); return c && c.sc && /^#[0-9a-f]{6}$/i.test(c.sc[sn]||'') ? c.sc[sn] : color(cn); };
const tint = (hx, a) => { const n = parseInt(hx.slice(1), 16), f = s => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * a); return 'rgb(' + f(16) + ',' + f(8) + ',' + f(0) + ')'; };
const resv = a => (a && +a.res) || 0;

/* ───── Ventanas modales sencillas ───── */
function modal(html, onClose) {
  closeModal(); const w = document.createElement('div'); w.className = 'mdw'; w.id = 'mdw';
  w.innerHTML = `<div class="md" role="dialog" aria-modal="true">${html}</div>`;
  w.addEventListener('mousedown', e => { if (e.target === w) { closeModal(); onClose && onClose(); } });
  document.body.appendChild(w); const f = w.querySelector('input,textarea,button'); if (f) setTimeout(() => f.focus(), 30); return w;
}
const closeModal = () => { const w = $('#mdw'); if (w) w.remove(); };
function askText(title, o) {
  o = o || {};
  return new Promise(res => {
    const w = modal(`<h3>${esc(title)}</h3>${o.text ? `<p class="st">${o.text}</p>` : ''}<input id="mq" class="w" type="${o.pw ? 'password' : 'text'}" autocomplete="${o.pw ? (o.newpw ? 'new-password' : 'current-password') : 'off'}" placeholder="${esc(o.ph||'')}">${o.confirm ? '<input id="mq2" class="w" type="password" autocomplete="new-password" placeholder="Repítela" style="margin-top:8px">' : ''}<p class="st" id="mqe"></p><div class="bar" style="justify-content:flex-end"><button class="bt g" id="mqc">Cancelar</button><button class="bt" id="mqo">${esc(o.ok||'Aceptar')}</button></div>`, () => res(null));
    const ok = () => { const v = w.querySelector('#mq').value;
      if (o.min && v.length < o.min) return w.querySelector('#mqe').textContent = 'Mínimo ' + o.min + ' caracteres.';
      if (o.confirm && v !== w.querySelector('#mq2').value) return w.querySelector('#mqe').textContent = 'Las contraseñas no coinciden.';
      closeModal(); res(v); };
    w.querySelector('#mqo').onclick = ok; w.querySelector('#mqc').onclick = () => { closeModal(); res(null); };
    w.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); }));
  });
}
function askChoice(title, text, opts) {
  return new Promise(res => {
    const w = modal(`<h3>${esc(title)}</h3><p class="st">${text}</p><div class="bar" style="justify-content:flex-end">${opts.map((o, i) => `<button class="bt ${o.cls||''}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`, () => res(null));
    w.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeModal(); res(opts[+b.dataset.i].v); });
  });
}
async function downloadFile(name, text, type) {
  const blob = new Blob([text], { type: type || 'application/json' });
  try { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ───── Selector de categorías (del prototipo) ───── */
const CHV = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
function cpLabel(v, only, blank) { const [c, s] = only ? [v||'', ''] : String(v||'|').split('|'); if (!c) return `<span class="pl pl0">${esc(blank||'Elegir categoría')}</span>${CHV}`; const bg = s ? subColor(c, s) : color(c); return `<span class="pl" style="background:${bg};color:${ink(bg)}">${esc(c + (s ? ' › ' + s : ''))}</span>${CHV}`; }
function cpick(id, v, sg, o) { o = o || {}; return `<span class="cpk" data-sg="${sg||0}" data-bl="${esc(o.blank||'')}" data-on="${o.only?1:0}"><input type="hidden" id="${id}" value="${esc(v||(o.only?'':'|'))}"${o.onch?` onchange="${o.onch}"`:''}><button type="button" class="cpb" onclick="cpOpen(this)">${cpLabel(v, o.only, o.blank)}</button></span>`; }
const cpDef = sg => { const c = S.cats.find(c => (sg > 0) === (c.t === 'i')); return c ? c.n + '|' + (c.s[0]||'') : '|'; };
function cpSet(id, v, sg) { const el = $('#' + id); if (!el) return; el.value = v; const w = el.parentElement; if (sg != null) w.dataset.sg = sg; w.querySelector('button').innerHTML = cpLabel(v, w.dataset.on === '1', w.dataset.bl); }
let CPX = null;
function cpListen() { setTimeout(() => { document.addEventListener('mousedown', cpOut, true); document.addEventListener('touchstart', cpOut, true); window.addEventListener('scroll', cpOutS, true); window.addEventListener('resize', cpClose); document.addEventListener('keydown', cpKey); }, 0); }
function cpOpen(btn) { cpClose(); const w = btn.parentElement; CPX = { w, btn, inp: w.querySelector('input'), sg: +w.dataset.sg, only: w.dataset.on === '1', bl: w.dataset.bl, exp: null }; const p = document.createElement('div'); p.className = 'cpp'; p.id = 'cpp'; p.addEventListener('click', cpClick); p.addEventListener('mouseover', cpHover); document.body.appendChild(p); cpDraw(); cpPos(); cpListen(); }
function cpDraw() {
  const X = CPX, p = document.getElementById('cpp'); if (!X || !p) return;
  const cats = S.cats.map((c, i) => ({ c, i })).filter(x => !X.sg || (X.sg > 0) === (x.c.t === 'i'));
  let h = '<div class="cpr">';
  if (X.bl) h += `<button type="button" class="pl pl0" data-k="clr">${X.only ? esc(X.bl) : 'Sin categoría'}</button>`;
  h += cats.map(({ c, i }) => { const bg = color(c.n), sub = !X.only && c.s.length; return `<button type="button" class="pl cpc${X.exp === i ? ' on' : ''}" data-i="${i}" style="background:${bg};color:${ink(bg)}">${esc(c.n)}${sub ? ' ›' : ''}</button>`; }).join('') + '</div>';
  if (!X.only) {
    const ec = X.exp != null && S.cats[X.exp], big = cats.reduce((b, x) => x.c.s.join('').length > (b ? b.c.s.join('').length : -1) ? x : b, null);
    if (big && big.c.s.length) {
      const row = (c, i, vis) => '<div class="cpr cpsr" style="grid-area:1/1;' + (vis ? '' : 'visibility:hidden;pointer-events:none') + '">' + c.s.map((n, j) => { const bg = subColor(c.n, n); return `<button type="button" class="pl cps" tabindex="${vis ? 0 : -1}" data-i="${i}" data-j="${j}" style="background:${bg};color:${ink(bg)}">${esc(n)}</button>`; }).join('') + '</div>';
      h += '<div class="cpsw">' + (ec && ec.s.length ? row(ec, X.exp, 1) : '<div class="cpr cpsr" style="grid-area:1/1"><span class="st" style="margin:6px 4px">Pulsa una categoría con › para ver sus subcategorías</span></div>') + row(big.c, big.i, 0) + '</div>';
    }
  }
  p.innerHTML = h;
}
function cpPos() { const X = CPX, p = document.getElementById('cpp'); if (!X || !p) return; const r = X.btn.getBoundingClientRect(), W = window.innerWidth, H2 = window.innerHeight; p.style.left = Math.max(8, Math.min(r.left, W - p.offsetWidth - 8)) + 'px'; const below = H2 - r.bottom, top = below < p.offsetHeight + 12 && r.top > below ? Math.max(8, r.top - p.offsetHeight - 6) : r.bottom + 6; p.style.top = top + 'px'; }
function cpHover(e) { const b = e.target.closest && e.target.closest('.cpc'); if (!b || !CPX || CPX.only || CPX.kind) return; const i = +b.dataset.i, ne = S.cats[i] && S.cats[i].s.length ? i : null; if (CPX.exp === ne) return; CPX.exp = ne; cpDraw(); }
function cpClick(e) { const b = e.target.closest && e.target.closest('button'); if (!b || !CPX) return; if (CPX.kind === 'c') return b.dataset.c ? clPick(b.dataset.c) : 0; if (b.dataset.k === 'clr') return cpPick(CPX.only ? '' : '|'); const i = +b.dataset.i, c = S.cats[i]; if (!c) return; if (b.classList.contains('cps')) return cpPick(c.n + '|' + c.s[+b.dataset.j]); if (CPX.only || !c.s.length) return cpPick(CPX.only ? c.n : c.n + '|'); if (CPX.exp === i) return cpPick(c.n + '|'); CPX.exp = i; cpDraw(); cpPos(); }
function cpPick(v) { const X = CPX; cpClose(); X.inp.value = v; X.btn.innerHTML = cpLabel(v, X.only, X.bl); X.inp.dispatchEvent(new Event('change', { bubbles: true })); }
function cpClose() { const p = document.getElementById('cpp'); if (p) p.remove(); CPX = null; document.removeEventListener('mousedown', cpOut, true); document.removeEventListener('touchstart', cpOut, true); window.removeEventListener('scroll', cpOutS, true); window.removeEventListener('resize', cpClose); document.removeEventListener('keydown', cpKey); }
function cpOut(e) { const p = document.getElementById('cpp'); if (p && !p.contains(e.target) && !(CPX && CPX.w.contains(e.target))) cpClose(); }
function cpOutS(e) { const p = document.getElementById('cpp'); if (p && e.target && p.contains(e.target)) return; cpClose(); }
function cpKey(e) { if (e.key === 'Escape') cpClose(); }
const h2x = (h, sa, l) => { sa /= 100; l /= 100; const k = n => (n + h/30) % 12, a = sa * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
const PAL = (() => { const hu = [355,25,48,85,140,170,195,215,245,275,320], L = [92,84,76,68,60,52,44,36,28,20], o = []; for (let r = 0; r < 10; r++) { o.push(h2x(0, 0, Math.round(100 - r*100/9))); hu.forEach(h => o.push(h2x(h, r < 2 ? 85 : 90, L[r]))); } return o; })();
function cswatch(id, v, on) { return `<span class="csw"><input type="hidden" id="${id}" value="${v}" oninput="${on}"><button type="button" class="swb" style="--c:${v}" title="Elegir color" aria-label="Elegir color" onclick="clOpen(this)"></button></span>`; }
function clOpen(btn) { cpClose(); const w = btn.parentElement; CPX = { w, btn, inp: w.querySelector('input'), kind: 'c' }; const p = document.createElement('div'); p.className = 'cpp clp'; p.id = 'cpp'; p.addEventListener('click', cpClick); document.body.appendChild(p); clDraw(); cpPos(); cpListen(); }
function clDraw() { const X = CPX, p = document.getElementById('cpp'); if (!X || !p) return; const cur = (X.inp.value||'').toLowerCase(); p.innerHTML = `<div class="clg">${PAL.map(c => `<button type="button" data-c="${c}" style="background:${c}" aria-label="${c}"${c === cur ? ' class="on"' : ''}></button>`).join('')}</div><div class="clf"><span class="pv" style="background:${cur}"></span><code>${cur.toUpperCase()}</code><label class="clc"><i></i>Personalizado<input type="color" value="${cur}"></label></div>`; const ci = p.querySelector('.clc input'); ci.addEventListener('input', e => { p.querySelector('.pv').style.background = e.target.value; }); ci.addEventListener('change', e => clPick(e.target.value)); }
function clPick(v) { const X = CPX; if (!X) return; X.inp.value = v; X.btn.style.setProperty('--c', v); cpClose(); X.inp.dispatchEvent(new Event('input', { bubbles: true })); }
const accOpts = sel => S.acc.map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${esc(a.name)}</option>`).join('');

/* ───── Gráficos ───── */
const gr = (c, al = .42) => x => { const a = x.chart.chartArea; if (!a) return c + '22'; const g = x.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, c + Math.round(al * 255).toString(16).padStart(2, '0')); g.addColorStop(1, c + '00'); return g; };
const vg = c => x => { const e = x.element; if (!e || !isFinite(e.y) || !isFinite(e.base) || e.y === e.base) return c; const g = x.chart.ctx.createLinearGradient(0, Math.min(e.y, e.base), 0, Math.max(e.y, e.base)); g.addColorStop(0, tint(c, .5)); g.addColorStop(1, c); return g; };
const dg = c => x => { const e = x.element; if (!e || !(e.outerRadius > 0) || !isFinite(e.innerRadius)) return c; const g = x.chart.ctx.createRadialGradient(e.x, e.y, e.innerRadius, e.x, e.y, e.outerRadius); g.addColorStop(0, c); g.addColorStop(1, tint(c, .45)); return g; };
const gl = ch => ((ch.config.type === 'doughnut' && Chart.overrides && Chart.overrides.doughnut ? Chart.overrides.doughnut.plugins.legend.labels.generateLabels : Chart.defaults.plugins.legend.labels.generateLabels)(ch)).map(l => { const t = ch.config.type, ds = ch.data.datasets[l.datasetIndex||0]; if (t === 'doughnut') { const c = ds.cols && ds.cols[l.index]; return c ? { ...l, fillStyle: c, strokeStyle: c, lineWidth: 0 } : l; } return t === 'line' ? { ...l, fillStyle: l.strokeStyle, lineWidth: 0 } : l; });
function mk(id, cfg) {
  const cs = getComputedStyle(document.documentElement), Vv = k => cs.getPropertyValue(k).trim(), dn = cfg.type === 'doughnut', o = cfg.options || {}, many = cfg.type === 'line' && cfg.data.labels.length > 6;
  Chart.defaults.color = Vv('--mu'); Chart.defaults.font.family = Vv('--f') || 'system-ui,sans-serif'; Chart.defaults.font.size = 12;
  const tt = { backgroundColor: 'rgba(28,28,30,.94)', titleColor: '#fff', bodyColor: '#fff', padding: 12, cornerRadius: 12, usePointStyle: true, boxPadding: 5, titleFont: { weight: '600' }, callbacks: { label: dn ? cfg.tcb : c => ' ' + c.dataset.label + ': ' + eur(c.parsed.y) } };
  if (cfg.type === 'line') cfg.data.datasets.forEach(d => { d.pointBackgroundColor = Vv('--sf'); d.pointBorderColor = d.borderColor; });
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, interaction: { mode: dn ? 'nearest' : 'index', intersect: dn } }, dn ? {} : { scales: { x: { grid: { display: false }, border: { display: false } }, y: { border: { display: false }, grid: { color: Vv('--ln') }, ticks: { maxTicksLimit: 6, callback: v => Math.abs(v) >= 1000 ? (v/1000).toLocaleString('es-ES') + ' k€' : v + ' €' } } }, elements: { line: { tension: .4, borderWidth: 2.5 }, point: { radius: many ? 0 : 3.5, hoverRadius: 6, borderWidth: 2 }, bar: { borderRadius: 7, borderSkipped: false } }, datasets: { bar: { maxBarThickness: 26, categoryPercentage: .7 } } }, o, { plugins: Object.assign({ legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 16, generateLabels: gl } }, tooltip: tt }, o.plugins || {}) });
  charts.push(new Chart(document.getElementById(id), cfg));
}

/* ───── Navegación ───── */
function yp(d) { if (V === 'panel') { const L = ryrs(), n = d < 0 ? L.filter(y => y < Y).pop() : L.find(y => y > Y); if (n != null) Y = n; } else Y += d; render(); }
function render() {
  cpClose(); charts.forEach(c => c.destroy()); charts = [];
  if (V === 'panel') { const L = ryrs(); if (L.length && !L.includes(Y)) Y = L.reduce((b, y) => Math.abs(y - Y) < Math.abs(b - Y) ? y : b); }
  const L = ryrs(), pn = V === 'panel', fr = pn || V === 'plan';
  $('#yrw').hidden = !fr; $('#yb0').disabled = pn && !L.some(y => y < Y); $('#yb1').disabled = pn && !L.some(y => y > Y);
  $('#yr').textContent = Y;
  document.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === V));
  $('#ttl').textContent = { panel: 'Panel', mov: 'Movimientos', imp: 'Añadir', plan: 'Previsión', notas: 'Notas', aj: 'Ajustes' }[V];
  ({ panel: vPanel, mov: vMov, imp: vImp, plan: vPlan, aj: vAj, notas: vNotas })[V]();
}
const go = v => { V = v; render(); window.scrollTo(0, 0); };

/* ───── Panel ───── */
function vPanel() {
  const r = real(Y), I = r.reduce((a, m) => a + m.i, 0), G = r.reduce((a, m) => a + m.g, 0);
  if (!S.acc.length && !S.tx.length) return M().innerHTML = `<div class="cd emp"><h2>Empecemos</h2><p>Añade vuestras cuentas e importa el primer extracto para ver aquí el panel del año.</p><button class="bt" onclick="go('aj')">Añadir cuentas</button> <button class="bt g" onclick="go('imp')">Importar un PDF</button></div>`;
  M().innerHTML = `${ryrs().length > 1 ? `<div class="sg" style="margin-bottom:12px">${ryrs().map(y => `<button class="${y === Y ? 'on' : ''}" onclick="Y=${y};render()">${y}</button>`).join('')}</div>` : ''}<div class="kp">${[['Ingresos del año', I], ['Gastos del año', G], ['Ahorro del año', I - G], ['Patrimonio actual', cur()]].map(([l, v]) => `<div class="cd"><span>${l}</span><b>${eur(v)}</b></div>`).join('')}</div><div class="gr">${[['c1', 'Gastos vs ingresos por mes', 's12'], ['c2', 'Ingresos vs gastos por año', 's5'], ['c4', 'División de gastos del año', 's7'], ['c3', 'Evolución de gastos', 's6'], ['c5', 'Ahorro real vs previsto', 's6'], ['c6', 'Previsión de ahorros a largo plazo', 's12']].map(([i, t, s]) => `<div class="cd ${s}"><h3>${t}</h3>${i == 'c6' ? `<div class="sg">${[5, 10, 20, 30].map(n => `<button class="${n == H ? 'on' : ''}" onclick="H=${n};render()">${n} años</button>`).join('')}</div>` : ''}<div class="ch"><canvas id="${i}"></canvas></div></div>`).join('')}</div>`;
  if (!window.Chart) return toast('No se pudo cargar la librería de gráficos');
  const g = S.cats.filter(c => c.t === 'g'), ys = [...new Set([...S.tx.map(t => +t.date.slice(0, 4)), Y0])].sort(), sm = (a, k) => a.reduce((x, m) => x + m[k], 0), GR = '#30D158', RD = '#FF375F';
  const ix = r.map((m, k) => k).filter(k => r[k].i || r[k].g), rr = ix.map(k => r[k]);
  mk('c1', { type: 'bar', data: { labels: ix.map(k => MS[k]), datasets: [{ label: 'Ingresos', data: rr.map(m => m.i), backgroundColor: vg(GR) }, { label: 'Gastos', data: rr.map(m => m.g), backgroundColor: vg(RD) }] } });
  mk('c2', { type: 'bar', data: { labels: ys, datasets: [{ label: 'Ingresos', data: ys.map(y => sm(real(y), 'i')), backgroundColor: vg(GR) }, { label: 'Gastos', data: ys.map(y => sm(real(y), 'g')), backgroundColor: vg(RD) }] } });
  const fm = Math.max(0, r.findIndex(m => m.i || m.g));
  mk('c3', { type: 'line', data: { labels: MS.slice(fm), datasets: g.map(c => ({ label: c.n, data: r.slice(fm).map(m => (m.i || m.g) ? (m.c[c.n] || 0) : null), borderColor: color(c.n), backgroundColor: gr(color(c.n), .22), fill: true, spanGaps: true })) } });
  const cd = g.map(c => [c.n, r.reduce((a, m) => a + (m.c[c.n] || 0), 0)]).filter(x => x[1] > 0), ct = cd.reduce((a, x) => a + x[1], 0), pc4 = v => (v / ct * 100).toFixed(1).replace('.', ',') + ' %', css = getComputedStyle(document.documentElement);
  mk('c4', { type: 'doughnut', data: { labels: cd.map(x => x[0] + ' · ' + pc4(x[1])), datasets: [{ data: cd.map(x => x[1]), cols: cd.map(x => color(x[0])), backgroundColor: c => cd[c.dataIndex] ? dg(color(cd[c.dataIndex][0]))(c) : '#888', borderColor: css.getPropertyValue('--sf').trim(), borderWidth: 3, borderRadius: 8, spacing: 2, hoverOffset: 6 }] }, tcb: c => ' ' + eur(c.parsed) + ' (' + pc4(c.parsed) + ')', options: { cutout: '66%' }, plugins: [{ id: 'pct', afterDatasetsDraw(ch) { const a = ch.getDatasetMeta(0).data, d = ch.data.datasets[0].data, t = d.reduce((x, y) => x + y, 0), x = ch.ctx, A = ch.chartArea, F = css.getPropertyValue('--f').trim(), cx = (A.left + A.right) / 2, cy = (A.top + A.bottom) / 2; x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.font = '600 11px ' + F; a.forEach((e, i) => { if (d[i] / t < .05) return; const p = e.tooltipPosition(); x.fillText(Math.round(d[i] / t * 100) + ' %', p.x, p.y); }); x.fillStyle = css.getPropertyValue('--mu').trim(); x.font = '500 12px ' + F; x.fillText('Gastos del año', cx, cy - 13); x.fillStyle = css.getPropertyValue('--ink').trim(); x.font = '700 22px ' + F; x.fillText(eur(t), cx, cy + 10); x.restore(); } }] });
  // Ahorro real (patrimonio a fin de cada mes) frente a la previsión
  let pc = openY(Y), rc = pc; const pl = [], rl = [];
  for (let m = 0; m < 12; m++) {
    const p = pm(Y, m); pc += p.i - p.g; pl.push(pc); rc += r[m].i - r[m].g;
    const me = Y + '-' + pad2(m + 1) + '-31', past = Y < Y0 || (Y === Y0 && m <= cm);
    rl.push(!past ? null : me >= base() && S.acc.length ? wealthAt(me) : rc);
  }
  mk('c5', { type: 'line', data: { labels: MS, datasets: [{ label: 'Ahorro real', data: rl, borderColor: '#0A84FF', backgroundColor: gr('#0A84FF'), fill: true }, { label: 'Previsión', data: pl, borderColor: '#FF9F0A', borderDash: [6, 5] }] } });
  const y1 = Math.min(...ys), yy = Array.from({ length: Y0 + H - y1 }, (_, k) => y1 + k), rcl = y => y > Y0 ? null : y === Y0 ? cur() : openY(y + 1);
  mk('c6', { type: 'line', data: { labels: yy, datasets: [{ label: 'Ahorro real', data: yy.map(rcl), borderColor: '#30D158', backgroundColor: gr('#30D158'), fill: true }, { label: 'Previsión', data: yy.map(y => y < Y0 ? null : closeY(y)), borderColor: '#5E5CE6', backgroundColor: gr('#5E5CE6', .3), fill: true, borderDash: [6, 5] }] } });
}

/* ───── Movimientos ───── */
let TF = '', D1 = '', D2 = '', CF = '', AF = '', EM = 0, SELS = new Set(), BC = '|', TXD = null, LV = [];
function vMov() {
  EM = 0; SELS.clear();
  M().innerHTML = `<div class="cd"><div class="bar"><select onchange="TF=this.value;lst()"><option value="">Ingresos y gastos</option><option value="i"${TF === 'i' ? ' selected' : ''}>Solo ingresos</option><option value="g"${TF === 'g' ? ' selected' : ''}>Solo gastos</option></select><label class="st">Desde <input type="date" value="${D1}" onchange="D1=this.value;lst()"></label><label class="st">Hasta <input type="date" value="${D2}" onchange="D2=this.value;lst()"></label></div>
<div class="bar">${cpick('cf', CF, 0, { only: 1, blank: 'Todas las categorías', onch: 'CF=this.value;lst()' })}<select onchange="AF=this.value;lst()"><option value="">Todas las cuentas</option>${S.acc.map(a => `<option value="${a.id}"${AF === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select><input type="search" placeholder="Buscar concepto o comentario" value="${esc(Q)}" oninput="Q=this.value;lst()"><button class="bt g" onclick="TF=D1=D2=CF=AF=Q='';vMov()">Limpiar filtros</button></div><div id="ls"></div></div>`;
  lst();
}
function lst() {
  const q = Q.toLowerCase(), rg = D1 || D2;
  const L = S.tx.filter(t => (rg ? (!D1 || t.date >= D1) && (!D2 || t.date <= D2) : t.date.startsWith(String(Y))) && (!TF || (TF === 'i') === (t.amount > 0)) && (!CF || t.cat === CF) && (!AF || t.acc === AF) && (!q || (t.concept + ' ' + (t.note || '')).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date));
  const I = L.reduce((a, t) => a + (t.amount > 0 && !t.tr ? t.amount : 0), 0), G = L.reduce((a, t) => a - (t.amount < 0 && !t.tr ? t.amount : 0), 0), nt = L.filter(t => t.tr).length;
  LV = L.map(t => t.id);
  $('#ls').innerHTML = L.length ? `${TXD ? `<p class="st">${TXD.length} movimiento${TXD.length === 1 ? '' : 's'} eliminado${TXD.length === 1 ? '' : 's'} · <button class="bt g" onclick="bkUndo()">Deshacer</button></p>` : ''}<div class="sum"><span>${L.length} movimientos${rg ? '' : ' de ' + Y}</span>${nt ? `<span>${nt} traspaso${nt === 1 ? '' : 's'} sin contar</span>` : ''}<span class="ps">Ingresos ${eur(I)}</span><span class="ng">Gastos ${eur(G)}</span><b>Balance ${eur(I - G)}</b></div><div class="tw"><table>${L.map(t => `<tr data-id="${t.id}"${t.tr ? ' class="trf"' : ''}><td>${t.date.slice(8)}/${t.date.slice(5, 7)}/${t.date.slice(2, 4)}</td><td>${esc(t.concept)}${t.note ? ` <i title="${esc(t.note)}">●</i>` : ''}</td><td class="${t.amount < 0 ? 'ng' : 'ps'}">${eur2(t.amount)}</td><td>${cpick('mv' + t.id, t.cat + '|' + (t.sub || ''), t.amount > 0 ? 1 : -1, { blank: 'Elegir categoría', onch: `setCat('${t.id}',this.value)` })}</td><td style="white-space:nowrap"><button class="ic" title="Comentario y opciones" onclick="tgl('${t.id}')">✎</button>${EM ? `<input type="checkbox" title="Seleccionar" ${SELS.has(t.id) ? 'checked' : ''} onchange="bkTog('${t.id}',this.checked)">` : (t.tr ? '<span title="Traspaso entre cuentas propias (no cuenta)" style="color:var(--mu)">⇄</span>' : '')}</td></tr><tr id="n${t.id}" hidden><td colspan="5"><div class="row" style="margin:0"><input class="w" style="flex:1 1 200px" placeholder="Comentario (opcional)" value="${esc(t.note || '')}" onchange="txSet('${t.id}','note',this.value)"><select onchange="txSet('${t.id}','acc',this.value)"><option value="">Sin cuenta</option>${accOpts(t.acc)}</select><label class="st" style="margin:0"><input type="checkbox" ${t.tr ? 'checked' : ''} onchange="txSet('${t.id}','tr',this.checked?1:0)"> Traspaso entre cuentas propias (no cuenta como gasto ni ingreso)</label></div></td></tr>`).join('')}</table></div><div class="bk" id="bk"></div>` : '<p class="st">No hay movimientos con estos filtros.</p>';
  bkUI();
}
function txSet(id, k, v) { const t = S.tx.find(x => x.id === id); if (!t) return; t[k] = v; save(); if (k !== 'note') lst(); }
function setCat(id, v) { const t = S.tx.find(x => x.id === id), [c, s] = v.split('|'); t.cat = c; t.sub = s || ''; if (c) S.rules[norm(t.concept)] = { cat: c, sub: s || '' }; save(); }
const bkN = () => LV.filter(id => SELS.has(id)).length;
function bkUI() {
  const e = $('#bk'); if (!e) return; const n = bkN(), pl = (a, b) => n === 1 ? a : b; let h = '';
  if (!EM) h = '<button class="bt g" onclick="bkGo(1)">Editar</button>';
  else if (EM === 1) h = `<span class="st" style="margin:0">${n} seleccionado${pl('', 's')}</span><button class="bt g" onclick="bkAll()">${n && n === LV.length ? 'Quitar selección' : 'Seleccionar todo'}</button><button class="bt t" ${n ? '' : 'disabled'} onclick="bkGo('cat')">Cambiar categoría</button><button class="bt t" ${n ? '' : 'disabled'} onclick="bkGo('tr')">Marcar como traspaso</button><button class="bt d" ${n ? '' : 'disabled'} onclick="bkGo('del')">Eliminar</button><button class="bt g" onclick="bkGo(0)">Cancelar</button>`;
  else if (EM === 'cat') h = `<span class="st" style="margin:0">Nueva categoría para ${n} movimiento${pl('', 's')}:</span>${cpick('bcat', BC, 0, { blank: 'Elegir categoría', onch: 'BC=this.value;bkUI()' })}${BC && BC !== '|' ? '<button class="bt" onclick="bkOk()">Confirmar cambios</button>' : ''}<button class="bt g" onclick="bkGo(1)">Atrás</button>`;
  else if (EM === 'tr') h = `<span class="st" style="margin:0">${n} movimiento${pl('', 's')} dejarán de contar como gasto o ingreso.</span><button class="bt" onclick="bkOk()">Confirmar cambios</button><button class="bt g" onclick="bkGo(1)">Atrás</button>`;
  else h = `<span class="st" style="margin:0">Se eliminarán ${n} movimiento${pl('', 's')}.</span><button class="bt d" onclick="bkOk()">Confirmar cambios</button><button class="bt g" onclick="bkGo(1)">Atrás</button>`;
  e.innerHTML = h;
}
function bkGo(m) { if (m === 1 && EM === 0) TXD = null; if (m === 0) SELS.clear(); if (m === 'cat') BC = '|'; EM = m; if (m === 1 || m === 0) lst(); else bkUI(); }
function bkTog(id, on) { on ? SELS.add(id) : SELS.delete(id); bkUI(); }
function bkAll() { const all = bkN() === LV.length; LV.forEach(id => all ? SELS.delete(id) : SELS.add(id)); lst(); }
function bkOk() {
  const ids = new Set(LV.filter(id => SELS.has(id))); if (!ids.size) return;
  if (EM === 'cat') { const [c, sb] = BC.split('|'); if (!c) return; S.tx.forEach(t => { if (ids.has(t.id)) { t.cat = c; t.sub = sb || ''; S.rules[norm(t.concept)] = { cat: c, sub: sb || '' }; } }); toast(ids.size + ' movimiento' + (ids.size === 1 ? '' : 's') + ' recategorizado' + (ids.size === 1 ? '' : 's')); }
  else if (EM === 'tr') S.tx.forEach(t => { if (ids.has(t.id)) t.tr = 1; });
  else if (EM === 'del') { TXD = S.tx.filter(t => ids.has(t.id)); S.tx = S.tx.filter(t => !ids.has(t.id)); }
  EM = 0; SELS.clear(); save(); lst();
}
function bkUndo() { if (!TXD) return; S.tx.push(...TXD); TXD = null; save(); lst(); }

/* ───── Añadir (PDF leído en el propio móvil) ───── */
function vImp() {
  if (!S.acc.length) return M().innerHTML = `<div class="cd emp"><h2>Primero, una cuenta</h2><p>Necesitas al menos una cuenta para indicar de cuál es el extracto.</p><button class="bt" onclick="go('aj')">Añadir cuenta</button></div>`;
  M().innerHTML = `<div class="cd"><h3>1. Sube el extracto</h3><div class="bar"><select id="pa" onchange="if(imp){imp.acc=this.value;rv()}">${accOpts(imp && imp.acc)}</select><label class="bt g fl">Elegir PDF<input type="file" id="pf" accept="application/pdf" onchange="$('#pfn').textContent=this.files[0]?this.files[0].name:'Ningún archivo seleccionado'"></label><span class="st" id="pfn" style="margin:0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Ningún archivo seleccionado</span><button class="bt" onclick="readPdf()">Leer PDF</button></div><div class="st" id="is">El PDF se lee en este dispositivo: no se envía a ningún sitio. Revisarás los movimientos antes de guardarlos.</div></div>
<div class="cd"><h3>¿Falta algún cargo? Añádelo a mano</h3><div class="bar"><input type="date" id="md" value="${today()}"><input id="mc" placeholder="Concepto"><select id="mt" onchange="cpSet('mk','|',this.value==='a'?1:-1)"><option value="c">Cargo</option><option value="a">Abono</option></select>${cpick('mk', '|', -1, { blank: 'Categoría (opcional)' })}<input id="mi" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Importe" style="width:110px"><button class="bt" onclick="addMan()">Añadir a la revisión</button></div></div><div id="rv"></div>`;
  if (imp) rv();
}
async function readPdf() {
  const f = $('#pf').files[0], acc = $('#pa').value; if (!f) return toast('Elige un PDF');
  $('#is').textContent = 'Leyendo el extracto…'; let pw, res;
  for (;;) {
    try { res = await PDFP.read(f, pw); break; }
    catch (e) {
      if (e && e.code === 'password') { pw = await askText(e.retry ? 'Contraseña incorrecta' : 'Este PDF está protegido', { pw: 1, text: 'Escribe la contraseña del PDF. Solo se usa para abrirlo en este dispositivo.' }); if (pw == null) { $('#is').textContent = ''; return; } continue; }
      $('#is').textContent = e && e.code === 'scanned' ? 'Este PDF no contiene texto (parece escaneado). Añade los movimientos a mano.' : 'No se pudo leer el PDF: ' + ((e && e.message) || 'error desconocido');
      return;
    }
  }
  lastPdfText = res.text;
  const rows = res.rows.map(r => { const k = matchCat(r.concept, r.amount), dup = S.tx.some(t => t.acc === acc && t.date === r.date && t.concept === r.concept && t.amount === r.amount); return { date: r.date, concept: r.concept, amount: r.amount, guess: r.guess, cat: k ? k.cat : '', sub: k ? k.sub : '', auto: !!k, from: k && k.sim < 1 ? k.from : '', dup, on: !dup, note: '' }; });
  imp = { acc, rows: (imp ? imp.rows.filter(r => r.man) : []).concat(rows), bal: res.bal, balDate: res.balDate };
  $('#is').innerHTML = rows.length ? `${rows.length} movimientos encontrados. ${rows.some(r => r.guess) ? '<b>Revisa el signo</b> de los marcados con ⚠︎. ' : ''}<button class="bt g" onclick="showPdfText()">Ver texto extraído</button>` : `No se han encontrado movimientos en este PDF. <button class="bt g" onclick="showPdfText()">Ver texto extraído</button>`;
  rv();
}
function showPdfText() { modal(`<h3>Texto extraído del PDF</h3><p class="st">Es lo que la app ha podido leer. Si los movimientos no salen bien, copia un fragmento <b>tapando tus datos</b> para ajustar el lector.</p><textarea readonly style="min-height:300px;font:12px ui-monospace,Menlo,monospace">${esc(lastPdfText)}</textarea><div class="bar" style="justify-content:flex-end;margin-top:10px"><button class="bt" onclick="closeModal()">Cerrar</button></div>`); }
function rv() {
  const ac = S.acc.find(a => a.id === ($('#pa') || { value: imp.acc }).value), ad = resv(ac);
  $('#rv').innerHTML = imp.rows.length ? `<div class="cd"><h3>2. Revisa y categoriza</h3><div class="bar"><label class="st">Saldo de la cuenta tras el último movimiento <input id="ib" type="number" inputmode="decimal" step="0.01" value="${imp.bal == null ? '' : imp.bal}" style="width:130px" oninput="imp.bal=this.value===''?null:+this.value"> €</label><label class="st">a fecha <input type="date" value="${imp.balDate || imp.rows.map(r => r.date).sort().pop() || ''}" onchange="imp.balDate=this.value"></label></div><p class="st">Se rellena si el extracto lo indica. Con este saldo se actualiza el patrimonio de la cuenta.</p>${ad ? `<p class="st"><b>${esc(ac.name)}</b> tiene ${eur(ad)} reservados que se muestran en otra cuenta: se restarán del saldo.${imp.bal != null && isFinite(imp.bal) ? ' Saldo que se guardará: <b>' + eur2(imp.bal - ad) + '</b>.' : ''}</p>` : ''}<div class="tw"><table>${imp.rows.map((r, i) => `<tr><td><input type="checkbox" ${r.on ? 'checked' : ''} onchange="imp.rows[${i}].on=this.checked;rvBtn()"></td><td>${r.date.slice(8)}/${r.date.slice(5, 7)}</td><td>${esc(r.concept)}${r.dup ? ' <em>posible duplicado</em>' : ''}</td><td class="${r.amount < 0 ? 'ng' : 'ps'}" style="cursor:pointer" title="Pulsa para cambiar el signo" onclick="flip(${i})">${r.guess ? '⚠︎ ' : ''}${eur2(r.amount)}</td><td>${cpick('ip' + i, r.cat + '|' + r.sub, r.amount > 0 ? 1 : -1, { blank: 'Elegir categoría', onch: `pk(${i},this.value)` })}${r.auto ? ' <small>' + (r.from ? 'auto · parecido a «' + esc(r.from) + '»' : 'auto') + '</small>' : ''}</td><td><button class="ic" title="Comentario" onclick="tgl('i${i}')">✎</button></td></tr><tr id="ni${i}" hidden><td colspan="6"><input class="w" placeholder="Comentario (opcional)" value="${esc(r.note)}" onchange="imp.rows[${i}].note=this.value"></td></tr>`).join('')}</table></div><p class="st">Pulsa un importe para cambiarle el signo si sale al revés.</p><p class="bar"><button class="bt" id="okb" onclick="okImp()">Guardar ${imp.rows.filter(r => r.on).length} movimientos</button><button class="bt d" onclick="disImp()">Descartar todo</button></p></div>` : '';
}
const rvBtn = () => { const b = $('#okb'); if (b) b.textContent = 'Guardar ' + imp.rows.filter(r => r.on).length + ' movimientos'; };
function flip(i) { const r = imp.rows[i]; r.amount = -r.amount; r.guess = false; const k = matchCat(r.concept, r.amount); if (r.auto || !r.cat) { r.cat = k ? k.cat : ''; r.sub = k ? k.sub : ''; r.auto = !!k; } rv(); }
function disImp() { imp = null; $('#rv').innerHTML = ''; const f = $('#pf'); if (f) f.value = ''; const fn = $('#pfn'); if (fn) fn.textContent = 'Ningún archivo seleccionado'; $('#is').textContent = 'Movimientos descartados. No se ha guardado nada.'; toast('Descartado'); }
function pk(i, v) { const [c, s] = v.split('|'), r = imp.rows[i]; r.cat = c; r.sub = s || ''; r.auto = false; r.from = ''; }
function okImp() {
  const L = imp.rows.filter(r => r.on), accId = ($('#pa') || { value: imp.acc }).value;
  L.forEach(r => { S.tx.push({ id: uid(), date: r.date, concept: r.concept, amount: r.amount, acc: accId, cat: r.cat, sub: r.sub, note: r.note, tr: 0 }); if (r.cat) S.rules[norm(r.concept)] = { cat: r.cat, sub: r.sub }; });
  if (L[0]) Y = +L[0].date.slice(0, 4);
  const ac = S.acc.find(a => a.id === accId), bd = imp.balDate || L.map(r => r.date).sort().pop(); let sv = false;
  if (ac && imp.bal != null && isFinite(imp.bal) && bd) { ac.snaps = (ac.snaps || []).filter(s => s.d !== bd).concat([{ d: bd, b: +imp.bal - resv(ac) }]).sort((a, b) => a.d.localeCompare(b.d)); sv = true; }
  imp = null; save(); toast(L.length + ' movimientos guardados' + (sv ? ' · saldo de la cuenta actualizado' : '')); go('mov');
}
function addMan() {
  const v = id => $('#' + id).value, a = Math.abs(+v('mi')), c = v('mc').trim();
  if (!v('md') || !c || !a) return toast('Rellena fecha, concepto e importe');
  const acc = $('#pa').value, amount = v('mt') === 'c' ? -a : a, dup = S.tx.some(t => t.acc === acc && t.date === v('md') && t.concept === c && t.amount === amount), ch = v('mk'), k = ch && ch !== '|' ? { cat: ch.split('|')[0], sub: ch.split('|')[1] || '' } : matchCat(c, amount);
  if (!imp) imp = { acc, rows: [] };
  imp.rows.push({ date: v('md'), concept: c, amount, cat: k ? k.cat : '', sub: k ? k.sub : '', auto: !!k && !(ch && ch !== '|'), from: '', dup, on: !dup, note: '', man: true });
  $('#mc').value = ''; $('#mi').value = ''; cpSet('mk', '|'); rv();
}

/* ───── Previsión ───── */
const FQL = { m: 'cada mes', d: 'total repartido mes a mes entre dos fechas', p: '14 pagas (extras en junio y diciembre)', s: 'al año, repartido en 12 meses', y: 'una vez al año', o: 'una sola vez' };
let PA = false, SC = 'y', lastDel = null;
function ep(id, k, v) { const p = S.plan.find(x => x.id === id); if (!p) return; if (k === 'amount' && SC === 'y') return splitAmt(p, v); if (k === 'cat') { const [c, s] = v.split('|'); p.cat = c; p.sub = s || ''; } else p[k] = v; save(); render(); if (k === 'freq' && v === 'd' && !p.end) toast('Indica el mes final en ⚙ (Hasta) para repartir el total'); }
function splitAmt(p, v) {
  const i = S.plan.indexOf(p), sy = +p.start.slice(0, 4), ey = p.end ? +p.end.slice(0, 4) : Infinity;
  if (p.freq === 'o' || p.freq === 'd' || (sy === Y && ey === Y) || Y < sy || Y > ey) { p.amount = v; save(); render(); return; }
  const mm = p.freq === 'y' ? p.start.slice(5, 7) : '01', g = 1 + (p.inc || 0) / 100, parts = [];
  if (sy < Y) parts.push(Object.assign({}, p, { id: uid(), end: (Y - 1) + '-12' }));
  parts.push(Object.assign({}, p, { amount: v, start: sy < Y ? Y + '-' + mm : p.start, end: ey > Y ? Y + '-12' : p.end }));
  if (ey > Y) parts.push(Object.assign({}, p, { id: uid(), amount: +(p.amount * Math.pow(g, Y + 1 - sy)).toFixed(2), start: (Y + 1) + '-' + mm }));
  S.plan.splice(i, 1, ...parts); save(); render(); toast('Importe cambiado solo para ' + Y);
}
function dp(id) { const i = S.plan.findIndex(x => x.id === id); if (i < 0) return toast('No se encontró la previsión'); lastDel = { p: S.plan[i], i }; S.plan.splice(i, 1); save(); render(); toast('Previsión eliminada', 2500); }
function pconf(id, c) { const e = $('#pd' + id); if (e) e.innerHTML = c ? `<button type="button" class="bt d" onclick="pconf('${id}')">Borrar</button>` : `<span class="st">¿Seguro que quieres borrarla?</span><button type="button" class="bt d" onclick="dp('${id}')">Sí, borrar</button><button type="button" class="bt g" onclick="pconf('${id}',1)">Cancelar</button>`; }
function undoDel() { if (!lastDel) return; S.plan.splice(Math.min(lastDel.i, S.plan.length), 0, lastDel.p); lastDel = null; save(); render(); }
const prow = (p, tot) => { const an = pan(p, Y), col = p.t === 'i' ? '#30D158' : color(p.cat), on = an > 0;
  return `<div class="pr" data-id="${p.id}" style="${on ? '' : 'opacity:.55'}"><span class="dot" style="background:${col}"></span><input class="pn" value="${esc(p.name)}" onchange="ep('${p.id}','name',this.value)"><div class="am"><input type="number" inputmode="decimal" step="any" min="0" value="${p.amount}" onchange="ep('${p.id}','amount',+this.value||0)"><span>€</span></div><select onchange="ep('${p.id}','freq',this.value)">${Object.entries(FQL).map(([k, l]) => `<option value="${k}"${p.freq === k ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="an">${on ? eur(an) + ' en ' + Y : 'Sin efecto en ' + Y}<br><small>${p.start.replace('-', '/')} → ${p.end ? p.end.replace('-', '/') : 'sin fin'}</small></span><button class="ic" title="Más opciones" onclick="const e=$('#pm${p.id}');e.hidden=!e.hidden">⚙</button>
<div class="bf"><div style="width:${tot ? Math.min(100, an / tot * 100) : 0}%;background:linear-gradient(90deg,${col},${tint(col, .45)})"></div></div>
<div class="mo" id="pm${p.id}" hidden><span class="st">Categoría ${cpick('pr' + p.id, p.cat + '|' + (p.sub || ''), p.t === 'i' ? 1 : -1, { blank: 'Sin categoría', onch: `ep('${p.id}','cat',this.value)` })}</span><label class="st">Desde <input type="month" value="${p.start}" onchange="if(this.value)ep('${p.id}','start',this.value)"></label><label class="st">Hasta <input type="month" value="${p.end || ''}" onchange="ep('${p.id}','end',this.value)"></label><label class="st">Subida anual <input type="number" inputmode="decimal" step="0.1" value="${p.inc || 0}" style="width:80px" onchange="ep('${p.id}','inc',+this.value||0)"> %</label><span class="row" id="pd${p.id}" style="margin:0"><button type="button" class="bt d" onclick="pconf('${p.id}')">Borrar</button></span></div></div>`; };
function psec(t, title, clr) {
  const L = S.plan.filter(p => p.t === t && (PA || pan(p, Y) > 0)), T = L.reduce((a, p) => a + pan(p, Y), 0); let body;
  if (!L.length) body = '<p class="st">No hay partidas para ' + Y + '. Añade una abajo.</p>';
  else if (t === 'i') body = L.map(p => prow(p, T)).join('');
  else { const cs = [...new Set(L.map(p => p.cat || 'Sin categoría'))].sort((a, b) => S.cats.findIndex(c => c.n === a) - S.cats.findIndex(c => c.n === b)); body = cs.map(c => { const G = L.filter(p => (p.cat || 'Sin categoría') === c), gt = G.reduce((a, p) => a + pan(p, Y), 0); return `<div class="cg"><b style="color:${color_(c)}">${esc(c)}</b><span>${eur(gt)} · ${eur(gt / 12)}/mes</span></div>` + G.map(p => prow(p, T)).join(''); }).join(''); }
  return `<div class="cd"><div class="sh"><h3 style="margin:0">${title}</h3><span class="st" style="margin:0"><b style="color:${clr}">${eur(T)}</b> al año · ${eur(T / 12)}/mes</span></div>${body}</div>`;
}
function vPlan() {
  const a = Array.from({ length: 12 }, (_, m) => pm(Y, m)), sm = k => a.reduce((x, m) => x + m[k], 0);
  M().innerHTML = `<div class="cd"><div class="sh"><label class="st" style="margin:0">Al cambiar un importe, aplicar: <select onchange="SC=this.value"><option value="y"${SC === 'y' ? ' selected' : ''}>solo a ${Y}</option><option value="all"${SC === 'all' ? ' selected' : ''}>a todos los años de la partida</option></select></label></div>${lastDel ? `<p class="st">«${esc(lastDel.p.name)}» borrada · <button class="bt g" onclick="undoDel()">Deshacer</button></p>` : ''}</div>
<div class="kp"><div class="cd"><span>Ingresos previstos ${Y}</span><b>${eur(sm('i'))}</b><small>${eur(sm('i') / 12)} al mes de media</small></div><div class="cd"><span>Gastos previstos ${Y}</span><b>${eur(sm('g'))}</b><small>${eur(sm('g') / 12)} al mes de media</small></div><div class="cd"><span>Ahorro previsto</span><b style="color:${sm('i') - sm('g') < 0 ? 'var(--ng)' : 'inherit'}">${eur(sm('i') - sm('g'))}</b><small>${eur((sm('i') - sm('g')) / 12)} al mes de media</small></div></div>
<details class="cd" ${S.plan.length ? '' : 'open'}><summary><b>+ Añadir partida</b></summary><div class="bar" style="margin-top:12px"><input id="pn" placeholder="Nombre (p. ej. Alquiler)"><select id="pt" onchange="cpSet('pk',cpDef(this.value==='i'?1:-1),this.value==='i'?1:-1)"><option value="g">Gasto</option><option value="i">Ingreso</option></select>${cpick('pk', cpDef(-1), -1, {})}<input id="pa2" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Importe" style="width:110px" oninput="pdHint()"><select id="pq" onchange="pdHint()">${Object.entries(FQL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><label class="st">Desde <input id="ps" type="month" value="${Y}-01" onchange="pdHint()"></label><label class="st">Hasta <input id="pe" type="month" onchange="pdHint()"></label><input id="pi" type="number" inputmode="decimal" step="0.1" placeholder="+%/año" style="width:90px"><button class="bt" onclick="addPl()">Añadir</button></div><p class="st" id="pdh"></p></details>
<div class="bar"><label class="st"><input type="checkbox" ${PA ? 'checked' : ''} onchange="PA=this.checked;render()"> Mostrar también las partidas que no afectan a ${Y}</label></div>
${psec('i', 'Ingresos previstos', '#30D158')}${psec('g', 'Gastos previstos', '#FF375F')}`;
}
function pdHint() { const v = id => $('#' + id).value, e = $('#pdh'); if (!e) return; if (v('pq') !== 'd') { e.textContent = ''; return; } const a = +v('pa2'); if (!v('ps') || !v('pe') || v('pe') < v('ps') || !a) { e.textContent = 'Indica el importe total y los meses de inicio y fin: se repartirá a partes iguales mes a mes.'; return; } const n = nm({ start: v('ps'), end: v('pe') }); e.textContent = eur(a) + ' en total entre ' + v('ps').replace('-', '/') + ' y ' + v('pe').replace('-', '/') + ' → ' + n + ' meses de ' + eur2(a / n); }
function addPl() { const v = id => $('#' + id).value, [c, s] = v('pk').split('|'), a = +v('pa2'); if (!v('pn') || !a || !v('ps')) return toast('Rellena nombre, importe y fecha de inicio'); if (v('pq') === 'd' && (!v('pe') || v('pe') < v('ps'))) return toast('Para repartir el total, elige un mes final igual o posterior al inicial'); S.plan.push({ id: uid(), name: v('pn'), t: v('pt'), cat: c, sub: s || '', amount: a, freq: v('pq'), start: v('ps'), end: v('pe'), inc: +v('pi') || 0 }); save(); render(); }

/* ───── Notas ───── */
let NS = null, NQ = '', ND = null, ntm = null;
const nsort = () => { const q = NQ.trim().toLowerCase(); return S.nts.filter(n => !q || ((n.title || '') + ' ' + (n.body || '')).toLowerCase().includes(q)).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (a.created || 0) - (b.created || 0)); };
const PIN = (sl, fill, sz) => `<svg width="${sz || 18}" height="${sz || 18}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 14v7"/>${sl ? '<path d="M4 4l16 16" stroke-width="2.2"/>' : ''}</svg>`;
const SRCH = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const PLUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
function nrow(n) { const on = n.id === NS; return `<div class="nrow" id="nr${n.id}"><button class="nit${on ? ' on' : ''}" onclick="nsel('${n.id}')">${n.pin ? `<span class="np" title="Fijada">${PIN(0, 1, 16)}</span>` : ''}<b id="nh${n.id}">${esc(n.title || 'Sin título')}</b><svg class="cv" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>${on ? `<div class="nbd"><input id="ntt" class="nti" placeholder="Título" value="${esc(n.title)}" oninput="nu('title',this.value)"><textarea class="ntx" placeholder="Escribe aquí…" oninput="nu('body',this.value)">${esc(n.body)}</textarea><div class="nft"><button class="npin" title="${n.pin ? 'Desfijar' : 'Fijar'}" aria-label="${n.pin ? 'Desfijar' : 'Fijar'}" onclick="npin()">${PIN(n.pin, 0)}</button><button class="bt d" onclick="ndel()">Borrar</button></div></div>` : ''}</div>`; }
function nlist() { const e = $('#nlist'); if (!e) return; const L = nsort(); e.innerHTML = L.length ? `<div class="nls">${L.map(nrow).join('')}</div>` : `<div class="nemp">${PIN(0, 0, 44)}<p>${NQ.trim() ? 'No hay notas que coincidan.' : 'Aún no hay notas. Pulsa + para escribir la primera.'}</p></div>`; }
function nsel(id) { if (ntm) { clearTimeout(ntm); ntm = null; save(); } NS = NS === id ? null : id; vNotas(); }
function nnew() { const n = { id: uid(), title: '', body: '', pin: false, created: Date.now() }; S.nts.push(n); NS = n.id; NQ = ''; save(); vNotas(); setTimeout(() => { const r = $('#nr' + n.id), e = $('#ntt'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (e && e.focus) e.focus({ preventScroll: true }); }, 0); }
function nu(k, v) { const n = S.nts.find(x => x.id === NS); if (!n) return; n[k] = v; if (k === 'title') { const h = $('#nh' + NS); if (h) h.textContent = v || 'Sin título'; } clearTimeout(ntm); ntm = setTimeout(() => { ntm = null; save(); }, 500); }
function npin() { const n = S.nts.find(x => x.id === NS); if (!n) return; n.pin = !n.pin; save(); vNotas(); }
function ndel() { const i = S.nts.findIndex(x => x.id === NS); if (i < 0) return; ND = S.nts[i]; S.nts.splice(i, 1); NS = null; save(); vNotas(); }
function nundo() { if (!ND) return; S.nts.push(ND); NS = ND.id; ND = null; save(); vNotas(); }
function vNotas() {
  if (ntm) { clearTimeout(ntm); ntm = null; save(); }
  if (NS && !S.nts.some(n => n.id === NS)) NS = null;
  M().innerHTML = `${ND ? `<p class="st">«${esc(ND.title || 'Sin título')}» borrada · <button class="bt g" onclick="nundo()">Deshacer</button></p>` : ''}<div class="nsr"><label class="srch">${SRCH}<input id="nq" type="search" placeholder="Buscar en notas" value="${esc(NQ)}" oninput="NQ=this.value;nlist()"></label><button class="nadd" title="Nueva nota" aria-label="Nueva nota" onclick="nnew()">${PLUS}</button></div><div id="nlist"></div>${syncBadge()}`;
  nlist();
}

/* ───── Ajustes: cuentas, categorías, copia de seguridad, seguridad ───── */
let EA = null, EC = null;
function vAj() {
  const accV = EA ? `<div class="cd"><h3>Cuentas · modificando</h3>${EA.map((a, i) => `<div class="cd" style="box-shadow:none;background:var(--bg)"><div class="row"><input value="${esc(a.name)}" placeholder="Nombre" oninput="EA[${i}].name=this.value" style="font-weight:600;flex:1 1 160px"><button class="ic" title="Quitar cuenta" onclick="EA.splice(${i},1);vAj()">×</button></div><div class="row"><label class="st">Saldo base <input type="number" inputmode="decimal" step="0.01" value="${a.bal}" style="width:130px;background:var(--sf)" oninput="EA[${i}].bal=+this.value||0"> €</label><label class="st">a fecha <input type="date" value="${a.bd || base()}" style="background:var(--sf)" onchange="EA[${i}].bd=this.value"></label></div><div class="row"><label class="st"><input type="checkbox" ${isHid(a) ? '' : 'checked'} onchange="EA[${i}].hid=!this.checked"> Mostrar en el panel</label><label class="st">Reservado que se muestra en otra cuenta <input type="number" inputmode="decimal" step="0.01" min="0" value="${a.res || 0}" style="width:110px;background:var(--sf)" oninput="EA[${i}].res=+this.value||0"> €</label></div></div>`).join('') || '<p class="st">No hay cuentas.</p>'}<div class="row"><input id="an" placeholder="Nueva cuenta (p. ej. Cuenta conjunta)"><input id="ab" type="number" inputmode="decimal" step="0.01" placeholder="Saldo actual" style="width:140px"><button class="bt g" onclick="addAc()">+ Añadir a la lista</button></div><div class="bar"><button class="bt" onclick="saveAc()">Guardar cambios</button><button class="bt g" onclick="EA=null;vAj()">Cancelar</button></div><p class="st"><b>Saldo base:</b> lo que había en la cuenta en esa fecha; a partir de ahí se suman los movimientos. Al importar un extracto con saldo, se usa el saldo del extracto.<br><b>Reservado:</b> si parte del dinero de esta cuenta lo apuntas aparte en otra cuenta (por ejemplo, unos ahorros), pon aquí esa cantidad y se restará al importar el saldo del banco, para no contarla dos veces.</p></div>`
  : `<div class="cd"><div class="bar"><h3 style="margin:0;flex:1">Cuentas</h3><button class="bt g" onclick="EA=dc(S.acc);vAj()">Modificar</button></div>${S.acc.length ? '<div class="ch" style="height:240px;margin-top:10px"><canvas id="ca"></canvas></div>' : '<p class="st">Aún no hay cuentas. Pulsa «Modificar» para añadir la primera.</p>'}<p style="font-size:17px;margin:12px 0 4px">Patrimonio total (todas las cuentas): <b>${eur(wealthAll('9999-12-31'))}</b></p><p class="st">Patrimonio en el panel: <b>${eur(cur())}</b> (último saldo importado de cada cuenta, o el saldo base, más los movimientos posteriores). El total incluye las cuentas ocultas, que no aparecen en el panel.</p></div>`;
  const catV = EC ? `<div class="cd"><h3>Categorías · modificando</h3>${EC.map((c, i) => `<div class="cd" style="box-shadow:none;background:var(--bg)"><div class="row">${cswatch('cc' + i, c.col, `EC[${i}].col=this.value`)}<input value="${esc(c.n)}" ${c.t === 'i' ? 'disabled' : ''} oninput="EC[${i}].n=this.value" style="font-weight:600">${c.t === 'i' ? '<small>categoría de ingresos</small>' : `<button class="ic" title="Quitar categoría" onclick="EC.splice(${i},1);vAj()">×</button>`}</div>${c.s.map((s, j) => `<div class="row">${cswatch('cs' + i + '_' + j, s.col || c.col, `EC[${i}].s[${j}].col=this.value`)}<input value="${esc(s.n)}" oninput="EC[${i}].s[${j}].n=this.value"><button class="ic" title="Quitar subcategoría" onclick="EC[${i}].s.splice(${j},1);vAj()">×</button></div>`).join('')}<div class="row"><input id="es${i}" placeholder="Nueva subcategoría"><button class="bt g" onclick="addSub(${i})">+</button></div></div>`).join('')}<div class="row"><input id="nc" placeholder="Nueva categoría de gasto"><button class="bt g" onclick="addCat()">+ Añadir a la lista</button></div><div class="bar"><button class="bt" onclick="saveCat()">Guardar cambios</button><button class="bt g" onclick="EC=null;vAj()">Cancelar</button></div><p class="st">Al renombrar, los movimientos, previsiones y reglas existentes se actualizan. No se puede quitar una categoría que se esté usando.</p></div>`
  : `<div class="cd"><div class="bar"><h3 style="margin:0;flex:1">Categorías</h3><button class="bt g" onclick="EC=S.cats.map(c=>({o:c.n,n:c.n,t:c.t,col:color(c.n),s:c.s.map(x=>({o:x,n:x,col:(c.sc&&c.sc[x])||undefined}))}));vAj()">Modificar</button></div>${S.cats.map(c => `<div class="row"><span class="pl" style="background:${color(c.n)};color:${ink(color(c.n))};cursor:default">${esc(c.n)}</span>${c.s.map(x => `<span class="pl" style="background:${subColor(c.n, x)};color:${ink(subColor(c.n, x))};cursor:default;font-weight:500">${esc(x)}</span>`).join('')}</div>`).join('')}</div>`;
  M().innerHTML = secCard() + accV + catV + `<div class="cd"><h3>Copia de seguridad</h3><div class="row"><button class="bt g" onclick="expB()">Exportar copia cifrada</button><label class="bt g fl">Importar copia<input type="file" accept=".json,application/json" onchange="impB(this.files[0]);this.value=''"></label></div><p class="st">La copia se cifra con una contraseña que eliges al exportarla. También puedes importar aquí el archivo exportado desde el prototipo de Claude.</p><div class="row"><label class="st">Fecha de inicio de las cuentas <input type="date" value="${base()}" onchange="S.cfg=Object.assign({},S.cfg,{base:this.value});save();render()"></label></div></div>${syncBadge()}`;
  accChart(); secLoad();
}
function accChart() {
  if (EA || !$('#ca') || !window.Chart) return;
  const L = S.acc.map(a => ({ n: a.name + (isHid(a) ? ' (oculta)' : ''), v: accAt(a, '9999-12-31'), h: isHid(a) })), u = unas('9999-12-31');
  if (Math.abs(u) >= .005) L.push({ n: 'Sin asignar', v: u, h: false, u: true });
  mk('ca', { type: 'bar', data: { labels: L.map(x => x.n), datasets: [{ label: 'Saldo', data: L.map(x => x.v), backgroundColor: c => { const x = L[c.dataIndex]; return x ? vg(x.v < 0 ? '#FF453A' : x.u ? '#8E8E93' : COL[c.dataIndex % COL.length])(c) : '#888'; } }] }, options: { plugins: { legend: { display: false } } } });
}
function addAc() { const n = $('#an').value.trim(); if (!n) return toast('Pon un nombre a la cuenta'); EA.push({ id: uid(), name: n, bal: +$('#ab').value || 0, bd: today(), hid: false, res: 0, snaps: [] }); vAj(); }
function saveAc() { const n = $('#an') && $('#an').value.trim(); if (n) EA.push({ id: uid(), name: n, bal: +$('#ab').value || 0, bd: today(), hid: false, res: 0, snaps: [] }); if (EA.some(a => !String(a.name).trim())) return toast('Todas las cuentas necesitan nombre'); EA.forEach(a => a.name = String(a.name).trim()); S.acc = EA; EA = null; save(); toast('Cuentas guardadas'); vAj(); }
function addSub(i) { const v = $('#es' + i).value.trim(); if (!v) return toast('Escribe el nombre de la subcategoría'); EC[i].s.push({ o: null, n: v }); vAj(); }
function addCat() { const v = $('#nc').value.trim(); if (!v) return toast('Escribe el nombre de la categoría'); const ii = EC.findIndex(c => c.t === 'i'); EC.splice(ii < 0 ? EC.length : ii, 0, { o: null, n: v, t: 'g', col: COL[EC.length % COL.length], s: [] }); vAj(); }
function saveCat() {
  const pend = $('#nc') && $('#nc').value.trim(); if (pend) { const ii = EC.findIndex(c => c.t === 'i'); EC.splice(ii < 0 ? EC.length : ii, 0, { o: null, n: pend, t: 'g', col: COL[EC.length % COL.length], s: [] }); }
  EC.forEach(c => { c.n = String(c.n).trim(); c.s.forEach(x => x.n = String(x.n).trim()); });
  if (EC.some(c => !c.n || c.s.some(x => !x.n))) return toast('Hay categorías o subcategorías sin nombre');
  if (new Set(EC.map(c => c.n.toLowerCase())).size !== EC.length) return toast('Hay dos categorías con el mismo nombre');
  if (EC.some(c => new Set(c.s.map(x => x.n.toLowerCase())).size !== c.s.length)) return toast('Hay subcategorías repetidas dentro de una categoría');
  const mp = new Map(), used = (c, s) => S.tx.some(t => t.cat === c && (t.sub || '') === s) || S.plan.some(p => p.cat === c && (p.sub || '') === s);
  for (const oc of S.cats) {
    const nc = EC.find(c => c.o === oc.n);
    if (!nc) { if (S.tx.some(t => t.cat === oc.n) || S.plan.some(p => p.cat === oc.n)) return toast('«' + oc.n + '» se está usando y no se puede quitar'); continue; }
    mp.set(oc.n + '|', [nc.n, '']);
    for (const os of oc.s) { const ns = nc.s.find(x => x.o === os); if (!ns) { if (used(oc.n, os)) return toast('«' + os + '» se está usando y no se puede quitar'); continue; } mp.set(oc.n + '|' + os, [nc.n, ns.n]); }
  }
  const mv = o => { const m = mp.get(o.cat + '|' + (o.sub || '')); if (m) { o.cat = m[0]; o.sub = m[1]; } };
  S.tx.forEach(mv); S.plan.forEach(mv);
  const nr = {}; Object.keys(S.rules).forEach(k => { const r = S.rules[k], m = mp.get(r.cat + '|' + (r.sub || '')); if (m) nr[k] = { cat: m[0], sub: m[1] }; }); S.rules = nr;
  S.cats = EC.map(c => { const o = { n: c.n, t: c.t, col: c.col, s: c.s.map(x => x.n) }, sc = {}; c.s.forEach(x => { if (x.col && x.col.toLowerCase() !== String(c.col).toLowerCase()) sc[x.n] = x.col; }); if (Object.keys(sc).length) o.sc = sc; return o; });
  EC = null; save(); toast('Categorías guardadas'); vAj();
}
async function expB() {
  const pw = await askText('Contraseña para la copia', { pw: 1, newpw: 1, confirm: 1, min: 8, ok: 'Exportar', text: 'La copia se guardará cifrada. Necesitarás esta contraseña para recuperarla: guárdala en un lugar seguro.' });
  if (!pw) return;
  toast('Cifrando…');
  const f = await CR.sealBackup(pw, S);
  await downloadFile('gastos-copia-' + today() + '.json', JSON.stringify(f));
}
async function impB(file) {
  if (!file) return; let o;
  try { o = JSON.parse(await file.text()); } catch (e) { return toast('Archivo no válido'); }
  if (o && o.app === 'gastos' && o.data) {
    const pw = await askText('Contraseña de la copia', { pw: 1 }); if (!pw) return;
    try { o = await CR.openBackup(pw, o); } catch (e) { return toast('Contraseña incorrecta o archivo dañado'); }
  }
  if (!o || !(Array.isArray(o.tx) || Array.isArray(o.acc))) return toast('El archivo no contiene datos de la app');
  const data = migrate(o);
  const how = await askChoice('Importar copia', `La copia tiene ${data.tx.length} movimientos, ${data.acc.length} cuentas, ${data.plan.length} previsiones y ${data.nts.length} notas.`, [{ label: 'Cancelar', cls: 'g', v: null }, { label: 'Unir con lo actual', cls: 't', v: 'merge' }, { label: 'Reemplazar lo actual', cls: 'd', v: 'replace' }]);
  if (!how) return;
  if (how === 'replace') { const now = Date.now(); lists(data).forEach(L => L.forEach(x => x.u = now)); Object.values(data.rules).forEach(r => r.u = now); data.catsU = data.cfgU = now; data.del = Object.assign({}, S.del); S = data; }
  else { S = merge(S, data); }
  save(); render(); toast('Datos importados');
}
