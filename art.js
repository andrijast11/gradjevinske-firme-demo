/* =========================================================
   Proceduralne izometrijske ilustracije (SVG)
   Bez slika — sve se crta kodom, pa se sajt učitava trenutno.
   ========================================================= */
(function () {
  const C = 0.866;
  let uid = 0;

  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function makeCtx(mode, seed) {
    const P = mode === 'blueprint'
      ? { top: 'none', right: 'none', left: 'none', stroke: 'rgba(220,235,255,.9)', sw: 1.2,
          win: 'none', winLit: 'none', winStroke: 'rgba(220,235,255,.55)', ground: 'none',
          groundStroke: 'rgba(220,235,255,.35)', accent: 'none', accentStroke: '#ffd2b8', tree: 'none',
          glass: 'none' }
      : { top: '#3d3b37', right: '#2b2a27', left: '#1e1d1b', stroke: 'rgba(0,0,0,.35)', sw: .6,
          win: '#121211', winLit: '#ffb46b', winStroke: 'none', ground: '#161614',
          groundStroke: 'rgba(255,255,255,.06)', accent: '#ff5a1f', accentStroke: 'rgba(0,0,0,.3)', tree: '#2f3a2c',
          glass: 'url(#GID)' };
    return { mode, P, r: rng(seed), out: [], pts: [] };
  }

  const pt = (x, y, z) => [(x - y) * C * 10, (x + y) * 0.5 * 10 - z * 10];

  function poly(ctx, arr, fill, stroke, sw, extra = '') {
    const p = arr.map(a => pt(a[0], a[1], a[2]));
    p.forEach(q => ctx.pts.push(q));
    ctx.out.push(`<polygon points="${p.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`);
  }
  function line(ctx, a, b, stroke, sw, extra = '') {
    const p = pt(...a), q = pt(...b);
    ctx.pts.push(p, q);
    ctx.out.push(`<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`);
  }
  function path(ctx, arr, stroke, sw, extra = '') {
    const p = arr.map(a => pt(a[0], a[1], a[2]));
    p.forEach(q => ctx.pts.push(q));
    ctx.out.push(`<polyline points="${p.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`);
  }

  // Kutija sa prozorima
  function box(ctx, b) {
    const { x, y, w, d, h } = b, P = ctx.P, bp = ctx.mode === 'blueprint';
    const floors = b.floors || Math.max(1, Math.round(h / 1.1));
    const fh = h / floors;
    const accent = b.accent;
    const fillT = accent ? (bp ? 'none' : '#ff6a33') : P.top;
    const fillR = accent ? (bp ? 'none' : '#e04a12') : P.right;
    const fillL = accent ? (bp ? 'none' : '#b33a0c') : P.left;
    const st = accent && bp ? P.accentStroke : P.stroke;
    // lica
    poly(ctx, [[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]], fillR, st, P.sw);
    poly(ctx, [[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], fillL, st, P.sw);
    poly(ctx, [[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], fillT, st, P.sw);
    if (b.noWin) return;
    const glass = b.glass;
    const litP = b.lit ?? 0.35;
    // prozori desno lice (ravnina y-z)
    const colsR = b.colsR || Math.max(1, Math.round(d / 1.2));
    const colsL = b.colsL || Math.max(1, Math.round(w / 1.2));
    const gap = glass ? 0.08 : 0.28;
    for (let f = 0; f < floors; f++) {
      const z0 = f * fh + fh * (glass ? 0.08 : 0.3), z1 = f * fh + fh * (glass ? 0.92 : 0.78);
      if (b.groundFloorOpen && f === 0) continue;
      for (let j = 0; j < colsR; j++) {
        const y0 = y + (j + gap) * d / colsR, y1 = y + (j + 1 - gap) * d / colsR;
        const lit = ctx.r() < litP;
        const fill = glass ? (lit ? '#ffcf9a' : P.glass) : (lit ? P.winLit : P.win);
        poly(ctx, [[x + w, y0, z0], [x + w, y1, z0], [x + w, y1, z1], [x + w, y0, z1]], fill, P.winStroke, .5, lit && !bp ? 'class="lit"' : '');
      }
      for (let j = 0; j < colsL; j++) {
        const x0 = x + (j + gap) * w / colsL, x1 = x + (j + 1 - gap) * w / colsL;
        const lit = ctx.r() < litP * 0.8;
        const fill = glass ? (lit ? '#e8a873' : P.glass) : (lit ? '#d98b4a' : P.win);
        poly(ctx, [[x0, y + d, z0], [x1, y + d, z0], [x1, y + d, z1], [x0, y + d, z1]], fill, P.winStroke, .5, lit && !bp ? 'class="lit"' : '');
      }
    }
  }

  function ground(ctx, x0, y0, x1, y1) {
    poly(ctx, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], ctx.P.ground, ctx.P.groundStroke, 1);
    // linije mreže
    for (let i = x0 + 2; i < x1; i += 2) line(ctx, [i, y0, 0], [i, y1, 0], ctx.P.groundStroke, .5);
    for (let i = y0 + 2; i < y1; i += 2) line(ctx, [x0, i, 0], [x1, i, 0], ctx.P.groundStroke, .5);
  }

  function tree(ctx, x, y, s = 1) {
    const bp = ctx.mode === 'blueprint';
    line(ctx, [x, y, 0], [x, y, 0.8 * s], bp ? ctx.P.stroke : '#2a2622', 1.2);
    const [cx, cy] = pt(x, y, 1.3 * s);
    ctx.pts.push([cx, cy]);
    ctx.out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(6 * s).toFixed(1)}" fill="${bp ? 'none' : ctx.P.tree}" stroke="${bp ? ctx.P.stroke : 'rgba(0,0,0,.3)'}" stroke-width="${bp ? 1 : .5}"/>`);
  }

  function crane(ctx, x, y, h, jib, angle = 0.6) {
    const bp = ctx.mode === 'blueprint';
    const col = bp ? ctx.P.accentStroke : '#ff5a1f';
    const m = 0.35;
    // stub (rešetka)
    [[0, 0], [m, 0], [m, m], [0, m]].forEach(o => line(ctx, [x + o[0], y + o[1], 0], [x + o[0], y + o[1], h], col, 1.4));
    for (let z = 0; z < h; z += 0.9) {
      line(ctx, [x, y, z], [x + m, y, z + 0.9], col, .6);
      line(ctx, [x, y + m, z], [x, y, z + 0.9], col, .6);
    }
    // strela
    const dx = Math.cos(angle) * jib, dy = Math.sin(angle) * jib;
    const cx = x + m / 2, cy = y + m / 2;
    line(ctx, [cx - dx * 0.3, cy - dy * 0.3, h], [cx + dx, cy + dy, h], col, 2);
    line(ctx, [cx, cy, h + 1.6], [cx + dx * 0.8, cy + dy * 0.8, h], col, .7);
    line(ctx, [cx, cy, h + 1.6], [cx - dx * 0.3, cy - dy * 0.3, h], col, .7);
    line(ctx, [cx, cy, h], [cx, cy, h + 1.6], col, 1.4);
    // protivteg
    const [px, py] = pt(cx - dx * 0.28, cy - dy * 0.28, h);
    ctx.out.push(`<rect x="${(px - 4).toFixed(1)}" y="${py.toFixed(1)}" width="8" height="6" fill="${bp ? 'none' : '#e8e4dc'}" stroke="${col}" stroke-width=".8"/>`);
    // kuka sa teretom
    const hx = cx + dx * 0.62, hy = cy + dy * 0.62, hz = h * 0.55;
    ctx.out.push('<g class="hook">');
    line(ctx, [hx, hy, h], [hx, hy, hz], bp ? ctx.P.stroke : 'rgba(255,255,255,.6)', .6);
    const [bx, by] = pt(hx, hy, hz);
    ctx.out.push(`<rect x="${(bx - 9).toFixed(1)}" y="${by.toFixed(1)}" width="18" height="3" fill="${bp ? 'none' : '#e8e4dc'}" stroke="${col}" stroke-width=".6"/>`);
    ctx.out.push('</g>');
  }

  function scaffold(ctx, x, y, w, d, h) {
    const bp = ctx.mode === 'blueprint';
    const col = bp ? ctx.P.accentStroke : 'rgba(255,140,80,.85)';
    const o = 0.35;
    for (let z = 0; z <= h; z += 1) {
      path(ctx, [[x + w + o, y - o, z], [x + w + o, y + d + o, z], [x - o, y + d + o, z]], col, .8);
    }
    for (let t = 0; t <= d + 2 * o; t += 1.4) line(ctx, [x + w + o, y - o + t, 0], [x + w + o, y - o + t, h], col, .8);
    for (let t = 0; t <= w + 2 * o; t += 1.4) line(ctx, [x - o + t, y + d + o, 0], [x - o + t, y + d + o, h], col, .8);
    for (let z = 0; z < h; z += 1) {
      line(ctx, [x + w + o, y - o, z], [x + w + o, y + d / 2, z + 1], col, .4);
      line(ctx, [x - o, y + d + o, z], [x + w / 2, y + d + o, z + 1], col, .4);
    }
  }

  function roof(ctx, x, y, w, d, h, rh) {
    const P = ctx.P, bp = ctx.mode === 'blueprint';
    const m = y + d / 2;
    poly(ctx, [[x, y + d, h], [x + w, y + d, h], [x + w, m, h + rh], [x, m, h + rh]], bp ? 'none' : '#5a3a2c', P.stroke, P.sw);
    poly(ctx, [[x + w, y, h], [x + w, y + d, h], [x + w, m, h + rh]], bp ? 'none' : '#3d3b37', P.stroke, P.sw);
  }

  function dim(ctx, a, b, label) {
    if (ctx.mode !== 'blueprint') return;
    line(ctx, a, b, 'rgba(255,210,184,.8)', .7, 'stroke-dasharray="3 3"');
    const p = pt(...a), q = pt(...b);
    ctx.out.push(`<text x="${((p[0] + q[0]) / 2).toFixed(1)}" y="${((p[1] + q[1]) / 2 - 4).toFixed(1)}" fill="#ffd2b8" font-family="JetBrains Mono, monospace" font-size="7" text-anchor="middle">${label}</text>`);
  }

  // Sortiranje: kutije crtamo od dalje ka bližoj
  function boxes(ctx, list) {
    list.slice().sort((a, b) => (a.x + a.w / 2 + a.y + a.d / 2) - (b.x + b.w / 2 + b.y + b.d / 2)).forEach(b => {
      if (b.type === 'tree') tree(ctx, b.x, b.y, b.s);
      else box(ctx, b);
    });
  }

  const SCENES = {
    tower(ctx) {
      ground(ctx, -6, -6, 16, 16);
      boxes(ctx, [
        { x: -4, y: 6, w: 4, d: 4, h: 6, floors: 6 },
        { x: 7, y: -4, w: 4, d: 3, h: 8, floors: 8 },
        { x: 2, y: 2, w: 8, d: 7, h: 3, floors: 2, lit: .6, glass: true, colsR: 6, colsL: 7 },
        { x: 4, y: 4, w: 4, d: 4, h: 24, floors: 24, lit: .42 },
        { x: 4.6, y: 4.6, w: 2.8, d: 2.8, h: 26.5, floors: 1, noWin: true, accent: true },
        { type: 'tree', x: 12, y: 10 }, { type: 'tree', x: 12, y: 12.5 }, { type: 'tree', x: 1, y: 12 }, { type: 'tree', x: 3.5, y: 13 }
      ]);
      crane(ctx, 11, 1, 30, 11, 2.6);
      dim(ctx, [8.5, 4, 0], [8.5, 4, 24], '84.00 m');
    },
    residential(ctx) {
      ground(ctx, -2, -2, 20, 20);
      const L = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        L.push({ x: i * 6, y: j * 8, w: 3.5, d: 6, h: 7 + ((i + j) % 2) * 2, floors: 7 + ((i + j) % 2) * 2, lit: .45 });
      }
      L.push({ type: 'tree', x: 4.5, y: 3 }, { type: 'tree', x: 10.5, y: 10 }, { type: 'tree', x: 16.5, y: 4 }, { type: 'tree', x: 4.6, y: 16 }, { type: 'tree', x: 10.6, y: 17 });
      boxes(ctx, L);
      dim(ctx, [0, 15, 0], [15.5, 15, 0], '62.40 m');
    },
    industrial(ctx) {
      ground(ctx, -3, -3, 26, 18);
      boxes(ctx, [
        { x: 0, y: 0, w: 18, d: 9, h: 3.2, floors: 1, colsR: 6, colsL: 12, lit: .7 },
        { x: 0, y: 11, w: 10, d: 4, h: 2.4, floors: 1, colsL: 6, colsR: 2, lit: .6 },
        { x: 20, y: 2, w: 2, d: 1, h: 1.2, noWin: true, accent: true },
        { x: 20, y: 5, w: 2, d: 1, h: 1.2, noWin: true, accent: true },
        { x: 14, y: 12, w: 3, d: 1.2, h: 1.4, noWin: true }
      ]);
      // svetlarnici na krovu
      for (let i = 1; i < 18; i += 2.2) {
        poly(ctx, [[i, 1, 3.2], [i + 1, 1, 3.2], [i + 1, 8, 3.2], [i, 8, 3.2]], ctx.mode === 'blueprint' ? 'none' : 'rgba(255,180,107,.18)', ctx.P.winStroke === 'none' ? 'rgba(255,255,255,.08)' : ctx.P.winStroke, .5);
      }
      dim(ctx, [0, -1.5, 0], [18, -1.5, 0], '96.00 m');
    },
    bridge(ctx) {
      const bp = ctx.mode === 'blueprint';
      // reka
      poly(ctx, [[-4, 2, 0], [26, 2, 0], [26, 10, 0], [-4, 10, 0]], bp ? 'none' : '#0f1a22', bp ? ctx.P.groundStroke : 'rgba(120,180,255,.12)', 1);
      for (let i = 0; i < 9; i++) line(ctx, [-2 + i * 3.2, 4 + (i % 3), 0], [0 + i * 3.2, 4 + (i % 3), 0], 'rgba(150,200,255,.25)', 1);
      poly(ctx, [[-4, -4, 0], [26, -4, 0], [26, 2, 0], [-4, 2, 0]], ctx.P.ground, ctx.P.groundStroke, 1);
      poly(ctx, [[-4, 10, 0], [26, 10, 0], [26, 16, 0], [-4, 16, 0]], ctx.P.ground, ctx.P.groundStroke, 1);
      // stubovi
      box(ctx, { x: 2, y: 0, w: 1, d: 1, h: 2, noWin: true });
      box(ctx, { x: 19, y: 0, w: 1, d: 1, h: 2, noWin: true });
      // luk
      const arch = [];
      for (let t = 0; t <= 1.0001; t += 0.05) arch.push([2.5 + t * 17, 0.5, 2 + Math.sin(Math.PI * t) * 8]);
      // zatege
      for (let t = 0.1; t < 1; t += 0.1) {
        const xx = 2.5 + t * 17;
        line(ctx, [xx, 0.5, 2 + Math.sin(Math.PI * t) * 8], [xx, 0.5 + 0, 2.2], bp ? ctx.P.stroke : 'rgba(255,255,255,.5)', .6);
      }
      path(ctx, arch, bp ? ctx.P.accentStroke : '#ff5a1f', 3.2, 'stroke-linecap="round"');
      // kolovoz preko reke (od obale do obale)
      box(ctx, { x: -4, y: 0, w: 30, d: 2.2, h: 2.3, noWin: true });
      const arch2 = arch.map(a => [a[0], a[1] + 1.7, a[2]]);
      path(ctx, arch2, bp ? ctx.P.accentStroke : '#ff7a45', 2.4, 'stroke-linecap="round"');
      for (let t = 0.1; t < 1; t += 0.1) {
        const xx = 2.5 + t * 17;
        line(ctx, [xx, 2.2, 2 + Math.sin(Math.PI * t) * 8], [xx, 2.2, 2.3], bp ? ctx.P.stroke : 'rgba(255,255,255,.5)', .6);
      }
      [[0, 12], [3, 13], [21, 12], [24, 13.5], [8, 13]].forEach(p => tree(ctx, p[0], p[1]));
      dim(ctx, [2.5, -2, 0], [19.5, -2, 0], 'L = 86.00 m');
    },
    office(ctx) {
      ground(ctx, -4, -4, 16, 16);
      boxes(ctx, [
        { x: 0, y: 0, w: 5, d: 5, h: 16, floors: 16, glass: true, colsR: 6, colsL: 6, lit: .3 },
        { x: 6.5, y: 1, w: 4.5, d: 4.5, h: 11, floors: 11, glass: true, colsR: 5, colsL: 5, lit: .4 },
        { x: 0, y: 6.5, w: 11, d: 3, h: 3, floors: 2, lit: .7 },
        { type: 'tree', x: 13, y: 11 }, { type: 'tree', x: 13, y: 13 }, { type: 'tree', x: 2, y: 12.5 }, { type: 'tree', x: 5, y: 13 }, { type: 'tree', x: 8, y: 12.5 }
      ]);
      box(ctx, { x: 5, y: 2, w: 1.5, d: 1.6, h: 10, floors: 10, colsR: 1, colsL: 1, lit: .8 });
      dim(ctx, [5, 0, 16], [0, 0, 16], '22.00 m');
    },
    villa(ctx) {
      ground(ctx, -3, -3, 14, 13);
      boxes(ctx, [
        { x: 0, y: 0, w: 7, d: 5, h: 2.4, floors: 2, lit: .55, colsL: 5, colsR: 3 },
        { x: 7.5, y: 0.5, w: 3, d: 4, h: 1.2, floors: 1, accent: false, lit: .7, glass: true, colsR: 3, colsL: 2 },
        { type: 'tree', x: 1, y: 8 }, { type: 'tree', x: 4, y: 9.5, s: 1.2 }, { type: 'tree', x: 11.5, y: 8 }
      ]);
      roof(ctx, 0, 0, 7, 5, 2.4, 1.8);
      scaffold(ctx, 0, 0, 7, 5, 4);
      dim(ctx, [0, 6.5, 0], [7, 6.5, 0], '14.20 m');
    },
    ba(ctx) {
      ground(ctx, -4, -4, 22, 18);
      boxes(ctx, [
        { x: 0, y: 0, w: 4, d: 7, h: 10, floors: 10, lit: .45 },
        { x: 6, y: 0, w: 4, d: 4, h: 18, floors: 18, lit: .4 },
        { x: 12, y: 0, w: 4, d: 7, h: 8, floors: 8, lit: .5 },
        { x: 3, y: 9, w: 12, d: 3, h: 2.4, floors: 2, glass: true, lit: .7, colsL: 12, colsR: 3 },
        { type: 'tree', x: 18, y: 4 }, { type: 'tree', x: 18, y: 8 }, { type: 'tree', x: 18, y: 12 }, { type: 'tree', x: 1, y: 14.5 }, { type: 'tree', x: 5, y: 15 }, { type: 'tree', x: 9, y: 15 }, { type: 'tree', x: 13, y: 15 }
      ]);
      dim(ctx, [10.5, 0, 0], [10.5, 0, 18], '63.00 m');
      dim(ctx, [0, -2, 0], [16, -2, 0], '56.00 m');
      dim(ctx, [17.5, 0, 0], [17.5, 7, 0], '24.50 m');
    }
  };

  function render(name, mode = 'solid', seed = 7) {
    const ctx = makeCtx(mode, seed);
    (SCENES[name] || SCENES.tower)(ctx);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ctx.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    const pad = 20;
    const vb = `${(x0 - pad).toFixed(0)} ${(y0 - pad).toFixed(0)} ${(x1 - x0 + pad * 2).toFixed(0)} ${(y1 - y0 + pad * 2).toFixed(0)}`;
    const gid = 'g' + (++uid);
    const defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4a5c"/><stop offset=".55" stop-color="#1b232c"/><stop offset="1" stop-color="#2c3540"/></linearGradient></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" class="iso iso--${mode}">${defs}${ctx.out.join('').replace(/GID/g, gid)}</svg>`;
  }

  window.IsoArt = { render };
})();
