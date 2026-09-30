// Economics diagrams rendered as crisp SVG. Everything is drawn in "data units"
// on a 0-10 x 0-10 grid and mapped to pixels, so every label sits exactly where
// the lines it names actually cross.
(function () {
  const W = 340, H = 280, L = 46, R = 58, T = 30, B = 40;
  const PW = W - L - R, PH = H - T - B;
  const INK = '#2b2233', FAINT = '#9a8f7a';
  const COL = { D: '#c0392b', S: '#1f6fb2', D1: '#e67e73', S1: '#5aa3dd', X: '#2e8b57', X1: '#7cc49a' };
  const FILL = ['#f6c85f', '#9fd49b', '#8fc5ec', '#f2a0a6', '#c9b3e8', '#f7d9a8'];

  const px = (x) => L + (x / 10) * PW;
  const py = (y) => T + PH - (y / 10) * PH;
  const f = (n) => Math.round(n * 10) / 10;

  // Lines are y = a + b*x in data units.
  const line = (a, b) => ({ a, b, at: (x) => a + b * x, xAt: (y) => (y - a) / b });
  const cross = (l1, l2) => { const x = (l2.a - l1.a) / (l1.b - l2.b); return [x, l1.at(x)]; };

  function clip(l, lo = 0.4, hi = 9.6) {
    // Clip an infinite line to the drawing box, returns [x1,y1,x2,y2].
    const pts = [];
    for (const x of [lo, hi]) { const y = l.at(x); if (y >= lo - 1e-9 && y <= hi + 1e-9) pts.push([x, y]); }
    if (l.b !== 0) for (const y of [lo, hi]) { const x = l.xAt(y); if (x > lo && x < hi) pts.push([x, y]); }
    pts.sort((p, q) => p[0] - q[0]);
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  }

  function svgOpen(title) {
    return `<svg class="econ-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title || 'Economics diagram'}" xmlns="http://www.w3.org/2000/svg">
<rect x="0" y="0" width="${W}" height="${H}" fill="#fffdf6"/>
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>`;
  }
  function axes(yLabel, xLabel) {
    return `<line x1="${L}" y1="${T + PH}" x2="${L}" y2="${T - 6}" stroke="${INK}" stroke-width="1.6" marker-end="url(#ah)"/>
<line x1="${L}" y1="${T + PH}" x2="${L + PW + 14}" y2="${T + PH}" stroke="${INK}" stroke-width="1.6" marker-end="url(#ah)"/>
<text x="6" y="14" font-size="11" text-anchor="start" fill="${INK}" font-weight="700">${yLabel}</text>
<text x="${L + PW + 12}" y="${T + PH + 26}" font-size="11" text-anchor="end" fill="${INK}" font-weight="700">${xLabel}</text>
<text x="${L - 6}" y="${T + PH + 14}" font-size="10" text-anchor="end" fill="${INK}">O</text>`;
  }
  function drawLine(l, label, color, opts = {}) {
    const c = clip(l, opts.lo, opts.hi); if (!c) return '';
    const [[x1, y1], [x2, y2]] = c;
    // Label at the end that sits further right (D ends bottom-right, S top-right).
    const [lx, ly] = [x2, y2];
    return `<line x1="${px(x1)}" y1="${py(y1)}" x2="${px(x2)}" y2="${py(y2)}" stroke="${color}" stroke-width="2.4"${opts.dash ? ' stroke-dasharray="6 4"' : ''} stroke-linecap="round"/>
<text x="${px(lx) + 5}" y="${py(ly) + (l.b < 0 ? 4 : 0)}" font-size="12" font-weight="700" fill="${color}">${label}</text>`;
  }
  function seg(x1, y1, x2, y2, color, label, opts = {}) {
    return `<line x1="${px(x1)}" y1="${py(y1)}" x2="${px(x2)}" y2="${py(y2)}" stroke="${color}" stroke-width="${opts.w || 2.4}"${opts.dash ? ' stroke-dasharray="6 4"' : ''}/>` +
      (label ? `<text x="${px(x2) + 5}" y="${py(y2) + 4}" font-size="12" font-weight="700" fill="${color}">${label}</text>` : '');
  }
  function guide(x, y, xl, yl) {
    // Dashed drop-lines from a point to both axes with axis labels.
    let s = `<line x1="${px(0)}" y1="${py(y)}" x2="${px(x)}" y2="${py(y)}" stroke="${FAINT}" stroke-width="1" stroke-dasharray="3 3"/>
<line x1="${px(x)}" y1="${py(y)}" x2="${px(x)}" y2="${py(0)}" stroke="${FAINT}" stroke-width="1" stroke-dasharray="3 3"/>`;
    if (yl) s += `<text x="${L - 5}" y="${py(y) + 4}" font-size="10.5" text-anchor="end" fill="${INK}">${yl}</text>`;
    if (xl) s += `<text x="${px(x)}" y="${T + PH + 14}" font-size="10.5" text-anchor="middle" fill="${INK}">${xl}</text>`;
    return s;
  }
  function dot(x, y, label, dx = 6, dy = -6) {
    return `<circle cx="${px(x)}" cy="${py(y)}" r="3.4" fill="${INK}"/>` +
      (label ? `<text x="${px(x) + dx}" y="${py(y) + dy}" font-size="11" font-weight="700" fill="${INK}">${label}</text>` : '');
  }
  function region(points, label, i) {
    const d = points.map((p, k) => `${k ? 'L' : 'M'}${f(px(p[0]))},${f(py(p[1]))}`).join(' ') + ' Z';
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    return `<path d="${d}" fill="${FILL[i % FILL.length]}" fill-opacity="0.85" stroke="${INK}" stroke-width="0.6"/>` +
      (label ? `<text x="${px(cx)}" y="${py(cy) + 4}" font-size="12" font-weight="800" text-anchor="middle" fill="${INK}">${label}</text>` : '');
  }
  const close = () => '</svg>';

  const Bld = {};

  // Demand/supply with one shift. opts: { shift:'D'|'S', dir:'right'|'left', yl, xl }
  Bld.shift = function (o) {
    const D = line(10, -1), S = line(0, 1);
    const k = o.dir === 'right' ? 2 : -2;
    const D1 = o.shift === 'D' ? line(10 + k, -1) : D;
    const S1 = o.shift === 'S' ? line(0 - k, 1) : S;
    const e0 = cross(D, S), e1 = cross(D1, S1);
    let s = svgOpen('Shift in ' + o.shift) + axes(o.yl || 'Price', o.xl || 'Quantity');
    s += guide(e0[0], e0[1], 'Q0', 'P0') + guide(e1[0], e1[1], 'Q1', 'P1');
    s += drawLine(D, 'D', COL.D) + drawLine(S, 'S', COL.S);
    if (o.shift === 'D') s += drawLine(D1, 'D1', COL.D1, { dash: true });
    else s += drawLine(S1, 'S1', COL.S1, { dash: true });
    s += dot(e0[0], e0[1], 'E0', -20, -6) + dot(e1[0], e1[1], 'E1', 6, -6);
    return s + close();
  };

  // Specific (per-unit) indirect tax with incidence areas A-D.
  Bld.tax = function () {
    const D = line(11, -1.2), S = line(1, 0.8), St = line(4, 0.8);
    const [q0, p0] = cross(D, S), [q1, p1] = cross(D, St), ps = S.at(q1);
    let s = svgOpen('Indirect tax') + axes('Price', 'Quantity');
    s += region([[0, p0], [q1, p0], [q1, p1], [0, p1]], 'A', 0);
    s += region([[0, ps], [q1, ps], [q1, p0], [0, p0]], 'B', 1);
    s += region([[q1, p1], [q0, p0], [q1, p0]], 'C', 2);
    s += region([[q1, p0], [q0, p0], [q1, ps]], 'D', 3);
    s += guide(q0, p0, 'Q0', 'P0') + guide(q1, p1, 'Q1', 'P1') + guide(q1, ps, '', 'P2');
    s += drawLine(D, 'D', COL.D) + drawLine(S, 'S', COL.S) + drawLine(St, 'S+tax', COL.S1, { dash: true });
    return s + close();
  };

  // Per-unit subsidy to producers.
  Bld.subsidy = function () {
    const D = line(9, -0.8), S = line(1, 0.8), Ss = line(-1, 0.8);
    const [q0, p0] = cross(D, S), [q1, p1] = cross(D, Ss), pr = S.at(q1);
    let s = svgOpen('Subsidy') + axes('Price', 'Quantity');
    s += region([[0, p1], [q1, p1], [q1, p0], [0, p0]], 'X', 1);
    s += region([[0, p0], [q1, p0], [q1, pr], [0, pr]], 'Y', 0);
    s += guide(q0, p0, 'Q0', 'P0') + guide(q1, p1, 'Q1', 'P1') + guide(q1, pr, '', 'P2');
    s += drawLine(D, 'D', COL.D) + drawLine(S, 'S', COL.S) + drawLine(Ss, 'S1', COL.S1, { dash: true, lo: 1.2 });
    return s + close();
  };

  // Maximum (ceiling) or minimum (floor) price.
  Bld.priceControl = function (o) {
    const D = line(9, -0.8), S = line(1, 0.8);
    const [q0, p0] = cross(D, S);
    const pc = o.kind === 'max' ? 3 : 7;
    const qs = S.xAt(pc), qd = D.xAt(pc);
    let s = svgOpen(o.kind === 'max' ? 'Maximum price' : 'Minimum price') + axes('Price', 'Quantity');
    s += guide(q0, p0, 'Qe', 'Pe');
    s += `<line x1="${px(0)}" y1="${py(pc)}" x2="${px(9.2)}" y2="${py(pc)}" stroke="#7b3fa0" stroke-width="2"/>`;
    s += `<text x="${px(9.25)}" y="${py(pc) + 4}" font-size="11" font-weight="700" fill="#7b3fa0">${o.kind === 'max' ? 'Pmax' : 'Pmin'}</text>`;
    s += guide(Math.min(qs, qd), pc, o.kind === 'max' ? 'Qs' : 'Qd', '') + guide(Math.max(qs, qd), pc, o.kind === 'max' ? 'Qd' : 'Qs', '');
    const yb = o.kind === 'max' ? pc - 0.6 : pc + 0.6;
    s += `<line x1="${px(Math.min(qs, qd))}" y1="${py(yb)}" x2="${px(Math.max(qs, qd))}" y2="${py(yb)}" stroke="${INK}" stroke-width="1.2" marker-start="url(#ah)" marker-end="url(#ah)"/>`;
    s += `<text x="${px((qs + qd) / 2)}" y="${py(yb) + (o.kind === 'max' ? 13 : -5)}" font-size="11" text-anchor="middle" font-weight="700" fill="${INK}">${o.kind === 'max' ? 'shortage' : 'surplus'}</text>`;
    s += drawLine(D, 'D', COL.D) + drawLine(S, 'S', COL.S);
    return s + close();
  };

  // Consumer and producer surplus at equilibrium.
  Bld.surplus = function () {
    const D = line(9, -0.8), S = line(1, 0.8);
    const [q0, p0] = cross(D, S);
    let s = svgOpen('Consumer and producer surplus') + axes('Price', 'Quantity');
    s += region([[0, D.at(0)], [0, p0], [q0, p0]], 'X', 0);
    s += region([[0, S.at(0)], [0, p0], [q0, p0]], 'Y', 1);
    s += region([[0, 0], [q0, 0], [q0, S.at(q0)], [0, S.at(0)]], 'Z', 2);
    s += guide(q0, p0, 'Qe', 'Pe');
    s += drawLine(D, 'D', COL.D) + drawLine(S, 'S', COL.S);
    return s + close();
  };

  // Price change along a demand curve with revenue rectangles.
  Bld.revenue = function () {
    const D = line(10, -1);
    const p0 = 8, p1 = 6, q0 = D.xAt(p0), q1 = D.xAt(p1);
    let s = svgOpen('Total revenue and a price fall') + axes('Price ($)', 'Quantity');
    s += region([[0, p1], [q0, p1], [q0, p0], [0, p0]], 'A', 3);
    s += region([[q0, 0], [q1, 0], [q1, p1], [q0, p1]], 'B', 1);
    s += region([[0, 0], [q0, 0], [q0, p1], [0, p1]], 'C', 2);
    s += guide(q0, p0, '2', '8') + guide(q1, p1, '4', '6');
    s += drawLine(D, 'D', COL.D);
    return s + close();
  };

  // Two demand curves through the same point: which is more price elastic?
  Bld.twoDemand = function () {
    const Da = line(9, -0.8), Db = line(6, -0.2);
    let s = svgOpen('Two demand curves') + axes('Price', 'Quantity');
    s += drawLine(Da, 'Da', COL.D) + drawLine(Db, 'Db', '#8e44ad');
    const [x, y] = cross(Da, Db);
    s += dot(x, y, 'P', 6, -8);
    return s + close();
  };

  // Production possibility curve with points and optional outward shift.
  Bld.ppc = function (o) {
    const r = 7.6, r1 = 9;
    const arc = (rad) => { let d = ''; for (let i = 0; i <= 40; i++) { const t = (Math.PI / 2) * (i / 40); d += `${i ? 'L' : 'M'}${f(px(rad * Math.cos(t)))},${f(py(rad * Math.sin(t)))} `; } return d; };
    let s = svgOpen('Production possibility curve') + axes('Capital goods', 'Consumer goods');
    s += `<path d="${arc(r)}" fill="none" stroke="${COL.X}" stroke-width="2.4"/>`;
    s += `<text x="${px(r * Math.cos(1.5)) + 4}" y="${py(r * Math.sin(1.5)) + 14}" font-size="12" font-weight="700" fill="${COL.X}">PPC</text>`;
    if (o && o.shift) {
      s += `<path d="${arc(r1)}" fill="none" stroke="${COL.X1}" stroke-width="2.4" stroke-dasharray="6 4"/>`;
      s += `<text x="${px(r1 * Math.cos(0.2)) + 4}" y="${py(r1 * Math.sin(0.2)) - 4}" font-size="12" font-weight="700" fill="${COL.X}">PPC1</text>`;
    }
    const pts = { A: [r * Math.cos(1.2), r * Math.sin(1.2)], B: [3, 2.6], C: [7.2, 6.8], D: [r * Math.cos(0.45), r * Math.sin(0.45)] };
    for (const k in pts) s += dot(pts[k][0], pts[k][1], k);
    return s + close();
  };

  // Aggregate demand / aggregate supply with a shift.
  Bld.adas = function (o) {
    const AD = line(9, -0.8), AS = line(1, 0.8);
    const k = o.dir === 'right' ? 1.6 : -1.6;
    const AD1 = o.shift === 'AD' ? line(9 + k * 0.8, -0.8) : AD;
    const AS1 = o.shift === 'AS' ? line(1 - k * 0.8, 0.8) : AS;
    const e0 = cross(AD, AS), e1 = cross(AD1, AS1);
    let s = svgOpen('AD/AS') + axes('Price level', 'Real output');
    s += guide(e0[0], e0[1], 'Y0', 'P0') + guide(e1[0], e1[1], 'Y1', 'P1');
    s += drawLine(AD, 'AD', COL.D) + drawLine(AS, 'AS', COL.S);
    if (o.shift === 'AD') s += drawLine(AD1, 'AD1', COL.D1, { dash: true });
    else s += drawLine(AS1, 'AS1', COL.S1, { dash: true });
    return s + close();
  };

  // Foreign exchange market for a currency.
  Bld.fx = function (o) {
    const D = line(9, -0.8), S = line(1, 0.8);
    const k = o.dir === 'right' ? 1.6 : -1.6;
    const D1 = o.shift === 'D' ? line(9 + k, -0.8) : D;
    const S1 = o.shift === 'S' ? line(1 - k, 0.8) : S;
    const e0 = cross(D, S), e1 = cross(D1, S1);
    let s = svgOpen('Exchange rate') + axes('$ price of 1 unit', 'Quantity of currency');
    s += guide(e0[0], e0[1], 'Q0', 'ER0') + guide(e1[0], e1[1], 'Q1', 'ER1');
    s += drawLine(D, 'D', COL.D) + drawLine(S, 'S', COL.S);
    if (o.shift === 'D') s += drawLine(D1, 'D1', COL.D1, { dash: true });
    else s += drawLine(S1, 'S1', COL.S1, { dash: true });
    return s + close();
  };

  // Tariff on imports in a small open economy (world price is horizontal).
  Bld.tariff = function () {
    const D = line(9, -0.8), S = line(1, 0.8), pw = 3, pt = 4;
    const qs0 = S.xAt(pw), qd0 = D.xAt(pw), qs1 = S.xAt(pt), qd1 = D.xAt(pt);
    let s = svgOpen('Tariff') + axes('Price', 'Quantity');
    s += region([[0, pw], [qs0, pw], [qs1, pt], [0, pt]], 'A', 0);
    s += region([[qs0, pw], [qs1, pw], [qs1, pt]], 'B', 3);
    s += region([[qs1, pw], [qd1, pw], [qd1, pt], [qs1, pt]], 'C', 2);
    s += region([[qd1, pw], [qd0, pw], [qd1, pt]], 'D', 3);
    s += seg(0, pw, 9.2, pw, '#7b3fa0', 'Pw', { w: 2 }) + seg(0, pt, 9.2, pt, '#b0508f', 'Pw+t', { w: 2, dash: true });
    s += guide(qs0, pw, 'Q1', '') + guide(qd0, pw, 'Q4', '') + guide(qs1, pt, 'Q2', '') + guide(qd1, pt, 'Q3', '');
    s += drawLine(D, 'Dd', COL.D) + drawLine(S, 'Sd', COL.S);
    return s + close();
  };

  // Lorenz curve and line of equality.
  Bld.lorenz = function () {
    let d = '', fill = `M${px(0)},${py(0)} `;
    for (let i = 0; i <= 40; i++) { const x = 10 * i / 40, y = 10 * Math.pow(x / 10, 2.3); d += `${i ? 'L' : 'M'}${f(px(x))},${f(py(y))} `; fill += `L${f(px(x))},${f(py(y))} `; }
    let s = svgOpen('Lorenz curve') + axes('Cumulative % income', 'Cumulative % population');
    // Area between equality line and Lorenz curve (A) and under the curve (B).
    let a = `M${px(0)},${py(0)} L${px(10)},${py(10)} `;
    for (let i = 40; i >= 0; i--) { const x = 10 * i / 40, y = 10 * Math.pow(x / 10, 2.3); a += `L${f(px(x))},${f(py(y))} `; }
    s += `<path d="${a}Z" fill="${FILL[0]}" fill-opacity="0.85"/>`;
    s += `<path d="${fill}L${px(10)},${py(0)} Z" fill="${FILL[2]}" fill-opacity="0.85"/>`;
    s += `<text x="${px(4.2)}" y="${py(3.4)}" font-size="13" font-weight="800" fill="${INK}">A</text>`;
    s += `<text x="${px(7.6)}" y="${py(1.5)}" font-size="13" font-weight="800" fill="${INK}">B</text>`;
    s += `<line x1="${px(0)}" y1="${py(0)}" x2="${px(10)}" y2="${py(10)}" stroke="${COL.X}" stroke-width="2"/>`;
    s += `<path d="${d}" fill="none" stroke="${COL.D}" stroke-width="2.4"/>`;
    s += `<text x="${px(5.2)}" y="${py(6.4)}" font-size="11" font-weight="700" fill="${COL.X}" transform="rotate(-37 ${px(5.2)} ${py(6.4)})">line of equality</text>`;
    s += `<text x="${px(7.2)}" y="${py(4.3)}" font-size="11" font-weight="700" fill="${COL.D}">Lorenz curve</text>`;
    s += `<text x="${px(10)}" y="${T + PH + 14}" font-size="10" text-anchor="middle" fill="${INK}">100%</text>`;
    s += `<text x="${L - 5}" y="${py(10) + 4}" font-size="10" text-anchor="end" fill="${INK}">100%</text>`;
    return s + close();
  };

  window.Graphs = {
    render(spec) {
      if (!spec) return '';
      const fn = Bld[spec.type];
      return fn ? fn(spec) : '';
    }
  };
})();
