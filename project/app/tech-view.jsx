// ── Technology view: initiatives using one or more selected technologies, with assessment criteria and manual priority ──

// Global priority order: assessment.rank ascending, unranked last, stable on original order.
// Ranks are sparse numbers (1, 2, 2.5, 3 …), not positions: the view shows 1, 2, 3 … by
// position, and a move only changes the rank of the moved initiative (see techRankUpdates).
const techRankOf = (i) => {
  const r = i?.assessment?.rank;
  return typeof r === 'number' && isFinite(r) ? r : Infinity;
};
function compareRank(a, b) {
  const ra = techRankOf(a), rb = techRankOf(b);
  if (ra === rb) return 0;
  return ra < rb ? -1 : 1;
}

// A short number strictly between lo and hi (either may be null = open end):
// between 2 and 3 → 2.5, between 2 and 6 → 4, after 7 → 8. null when there is no room.
function techRankBetween(lo, hi) {
  if (lo == null && hi == null) return 1;
  if (hi == null) return Math.floor(lo) + 1;
  if (lo == null) return Math.ceil(hi) - 1;
  if (!(lo < hi)) return null;
  const mid = (lo + hi) / 2;
  for (let d = 0; d <= 12; d++) {
    const m = Math.round(mid * 10 ** d) / 10 ** d;
    if (m > lo && m < hi) return m;
  }
  return mid > lo && mid < hi ? mid : null;
}

// Given the wanted global order (ids, top first), returns { id: newRank } for as few
// initiatives as possible: the ones whose current ranks already rise along the order
// (longest increasing run, the moved one excluded) keep their rank; the rest get a rank
// between their kept neighbours. A trailing run of still-unranked initiatives in their
// existing order is left unranked. Falls back to renumbering 1..N if numbers run out.
// So one drag changes one initiative → a short commit message and no clash with an
// editor moving something else at the same time (merge3 merges rank per initiative).
function techRankUpdates(ids, byId, movedId) {
  const cur = ids.map((id) => techRankOf(byId[id]));
  // Unranked tail that is already in its current (array) order needs no rank.
  const pos = Object.fromEntries(Object.keys(byId).map((id, k) => [id, k]));
  let end = ids.length;
  while (end > 0 && cur[end - 1] === Infinity && ids[end - 1] !== movedId &&
         (end === ids.length || pos[ids[end - 1]] < pos[ids[end]])) end--;

  // Longest strictly increasing subsequence of finite ranks in ids[0..end), O(n log n).
  const tails = [], tailIdx = [], prev = new Array(end).fill(-1);
  for (let k = 0; k < end; k++) {
    const r = cur[k];
    if (r === Infinity || ids[k] === movedId) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tails[m] < r) lo = m + 1; else hi = m; }
    tails[lo] = r; tailIdx[lo] = k;
    prev[k] = lo > 0 ? tailIdx[lo - 1] : -1;
  }
  const keep = new Set();
  for (let k = tailIdx[tails.length - 1] ?? -1; k >= 0; k = prev[k]) keep.add(k);

  const out = {};
  let ok = true;
  let last = null;   // rank of the item just above
  for (let k = 0; k < end && ok; k++) {
    if (keep.has(k)) { last = cur[k]; continue; }
    // A run of m items to place between `last` and the next kept rank `hi`.
    let j = k; while (j < end && !keep.has(j)) j++;
    const m = j - k, hi = j < end ? cur[j] : null;
    const lo = last != null ? last : hi != null ? Math.ceil(hi) - m - 1 : null;
    const step = hi != null && lo != null ? (hi - lo) / (m + 1) : null;
    let prevR = last;
    for (let n = 0; n < m; n++) {
      // Aim each item at its even slot: a short number between the item above and the next slot.
      const r = step == null ? techRankBetween(prevR, null)
        : techRankBetween(prevR ?? lo, n === m - 1 ? hi : lo + step * (n + 2));
      if (r == null || (hi != null && !(r < hi)) || (prevR != null && !(r > prevR))) { ok = false; break; }
      if (r !== cur[k + n]) out[ids[k + n]] = r;
      prevR = r;
    }
    last = prevR;
    k = j - 1;
  }
  if (ok) return out;
  const all = {};
  ids.slice(0, end).forEach((id, k) => { if (cur[k] !== k + 1) all[id] = k + 1; });
  return all;
}

// Score getters for the sortable columns. Each returns a number or null (unscored).
// 'combined' is the mean of Værdi and TTV, and only exists when both are scored.
const TECH_SCORE = {
  value:    (i) => i.assessment?.value?.score ?? null,
  ttv:      (i) => i.assessment?.ttv?.score ?? null,
  combined: (i) => {
    const v = i.assessment?.value?.score, t = i.assessment?.ttv?.score;
    return v != null && t != null ? (v + t) / 2 : null;
  },
};

// Sort by a score; unscored go last, ties fall back to priority order.
function sortByScore(list, key, dir) {
  const score = TECH_SCORE[key];
  return [...list].sort((a, b) => {
    const va = score(a), vb = score(b);
    if (va === null && vb === null) return compareRank(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return (dir === 'desc' ? vb - va : va - vb) || compareRank(a, b);
  });
}

// Danish number formatting with at most one decimal: 3.5 → "3,5".
const fmtScore = (n) => n == null ? '–' : n.toLocaleString('da-DK', { maximumFractionDigits: 1 });

// Quadrants of the Værdi × TTV matrix: a score of 4 or 5 counts as high.
// TTV 5 = fastest time-to-value, matching the "higher is better" sort of the column.
function techQuadrant(i) {
  const v = TECH_SCORE.value(i), t = TECH_SCORE.ttv(i);
  if (v == null || t == null) return null;
  if (v >= 4 && t >= 4) return 'quick';
  if (v >= 4) return 'bet';
  if (t >= 4) return 'easy';
  return 'rest';
}

// ── CSV export ────────────────────────────────────────────────────────────────
// Semicolon-separated with a BOM and decimal comma, so Danish Excel opens it directly.
function techExportCSV(rows, store, techNames) {
  const statusLabel = (s) => resolveStatus(s, store.statuses).label;
  const buName = (id) => (store.businessUnits || []).find((b) => b.id === id)?.name || '';
  const techName = (id) => (store.technologies || []).find((t) => t.id === id)?.name || '';
  const notes = (block) => commentsOf(block).map((c) => (c.at ? `${c.at}: ` : '') + c.text).join(' | ');
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Prio', 'Initiativ', 'Status', 'Ejer', 'BU', 'Teknologier', 'Værdi (1-5)', 'TTV (1-5)', 'Samlet',
    'Governance-klar', 'Værdi – kommentarer', 'Ejerskab – kommentarer', 'Strategi – kommentarer',
    'Gov. – kommentarer', 'TTV – kommentarer'];
  // Rejected ideas only reach the export when "Vis afviste" is on; then they're marked.
  const anyRejected = rows.some((r) => r.init.rejected);
  if (anyRejected) header.push('Afvist');
  const lines = rows.map(({ init: i, prio }) => {
    const a = i.assessment || {};
    const combined = TECH_SCORE.combined(i);
    const rej = i.rejected ? ['Ja', i.rejected.at, i.rejected.reason].filter(Boolean).join(' · ') : '';
    return [
      prio, i.name, statusLabel(i.status), i.owner || '', buName(i.buId),
      (i.techIds || []).map(techName).filter(Boolean).join(', '),
      a.value?.score ?? '', a.ttv?.score ?? '', combined == null ? '' : fmtScore(combined),
      a.readiness?.ready ? 'Ja' : 'Nej',
      notes(a.value), notes(a.ownership), notes(a.strategy), notes(a.readiness), notes(a.ttv),
      ...(anyRejected ? [rej] : []),
    ];
  });
  const csv = '﻿' + [header, ...lines].map((r) => r.map(cell).join(';')).join('\r\n');
  const slug = techNames.join('-').toLowerCase().replace(/[^a-z0-9æøå]+/g, '-').replace(/^-|-$/g, '') || 'teknologi';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-board-${slug}-${dateToISO(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function UiScoreEditor({ score, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', whiteSpace: 'nowrap' }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = score != null && n <= score;
        return (
          <button key={n} type="button" aria-label={`Score ${n}`} title={score === n ? 'Klik for at fjerne scoren' : `Score ${n}`}
            onClick={() => onChange(score === n ? null : n)} style={{
              width: 12, height: 12, borderRadius: 99, padding: 0, cursor: 'pointer',
              border: `1px solid ${on ? UI.ink : UI.borderStrong}`, background: on ? UI.ink : UI.panel,
            }} />
        );
      })}
      <span style={{ marginLeft: 4, fontFamily: UI.mono, fontSize: 10.5, fontWeight: 700, color: score != null ? UI.ink : UI.inkFaint, minWidth: 8 }}>
        {score ?? '–'}
      </span>
    </div>
  );
}

// ── Værdi × TTV matrix ────────────────────────────────────────────────────────
// 5×5 grid of score cells; initiatives sharing a cell are packed in a small grid.
// Each dot carries its priority number and status colour. Click selects the row below.
const TECH_QUADRANTS = [
  { id: 'bet',   label: 'Strategiske satsninger', x: 'left',  y: 'top'    },
  { id: 'quick', label: 'Hurtige gevinster',      x: 'right', y: 'top'    },
  { id: 'rest',  label: 'Overvej',                x: 'left',  y: 'bottom' },
  { id: 'easy',  label: 'Lette tilvalg',          x: 'right', y: 'bottom' },
];

// Dragging a dot (or an unscored chip from the tray below) onto a cell sets both scores
// through onScore(id, value, ttv). A press without movement is a plain click (select).
function UiValueTtvMatrix({ rows, statuses, selectedId, onSelect, onScore }) {
  const [hoverId, setHoverId] = React.useState(null);
  const [drag, setDrag] = React.useState(null); // { id, sx, sy, x, y, moved }
  const svgRef = React.useRef(null);
  const CELL = 52, ML = 30, MT = 8, MB = 30;
  const W = ML + CELL * 5 + 8, H = MT + CELL * 5 + MB;
  const cx = (t) => ML + (t - 1) * CELL + CELL / 2;   // TTV → x
  const cy = (v) => MT + (5 - v) * CELL + CELL / 2;   // Værdi → y (5 at the top)

  // Pointer position (client coords) → { v, t } of the cell under it, or null outside the grid.
  const cellAt = (x, y) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return null;
    const k = box.width / W;
    const t = Math.floor(((x - box.left) / k - ML) / CELL) + 1;
    const v = 5 - Math.floor(((y - box.top) / k - MT) / CELL);
    return t >= 1 && t <= 5 && v >= 1 && v <= 5 ? { v, t } : null;
  };

  // dragRef mirrors `drag` so the window handlers read the latest value without side effects in updaters.
  const dragRef = React.useRef(null);
  const putDrag = (d) => { dragRef.current = d; setDrag(d); };

  const startDrag = (id) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    putDrag({ id, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false });
  };

  // While dragging, follow the pointer on the window so it works outside the SVG too.
  React.useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      putDrag({ ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4 });
    };
    const up = (e) => {
      const d = dragRef.current;
      putDrag(null);
      if (!d) return;
      if (!d.moved) { onSelect(d.id === selectedId ? null : d.id); return; }
      const cell = cellAt(e.clientX, e.clientY);
      const init = rows.find((r) => r.init.id === d.id)?.init;
      if (cell && init && (TECH_SCORE.value(init) !== cell.v || TECH_SCORE.ttv(init) !== cell.t)) {
        onScore(d.id, cell.v, cell.t);
      }
    };
    const key = (e) => { if (e.key === 'Escape') putDrag(null); };
    window.addEventListener('pointermove', move);
    const cancel = () => putDrag(null);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [!!drag, selectedId, rows, onScore]);

  const dragging = drag && drag.moved;
  const dropCell = dragging ? cellAt(drag.x, drag.y) : null;
  const dragInit = dragging ? rows.find((r) => r.init.id === drag.id) : null;

  // Group scored rows per cell.
  const cells = {};
  rows.forEach((r) => {
    const v = TECH_SCORE.value(r.init), t = TECH_SCORE.ttv(r.init);
    if (v == null || t == null) return;
    const k = `${v}-${t}`;
    (cells[k] = cells[k] || []).push(r);
  });
  const dots = [];
  Object.entries(cells).forEach(([k, list]) => {
    const [v, t] = k.split('-').map(Number);
    const cols = Math.ceil(Math.sqrt(list.length));
    const gap = Math.min(18, (CELL - 6) / cols);
    const r = Math.max(4, Math.min(8.5, gap / 2 - 0.5));
    const nRows = Math.ceil(list.length / cols);
    list.forEach((row, n) => {
      const col = n % cols, rr = Math.floor(n / cols);
      const rowCount = rr === nRows - 1 ? list.length - rr * cols : cols;
      dots.push({
        row, r,
        x: cx(t) + (col - (rowCount - 1) / 2) * gap,
        y: cy(v) + (rr - (nRows - 1) / 2) * gap,
      });
    });
  });
  // Draw selected/hovered dots last so they sit on top.
  dots.sort((a, b) => (a.row.init.id === selectedId || a.row.init.id === hoverId) - (b.row.init.id === selectedId || b.row.init.id === hoverId));

  const mid = ML + CELL * 3, midY = MT + CELL * 2;   // quadrant borders between score 3 and 4
  const hover = rows.find((r) => r.init.id === (hoverId || selectedId));
  const unscoredRows = rows.filter((r) => TECH_SCORE.value(r.init) == null || TECH_SCORE.ttv(r.init) == null);
  const unscored = unscoredRows.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', fontFamily: UI.mono, maxWidth: '100%', height: 'auto', touchAction: 'none' }}
        onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}>
        {/* Quick-win quadrant tint */}
        <rect x={ML + CELL * 3} y={MT} width={CELL * 2} height={CELL * 2} fill="oklch(0.95 0.04 155)" />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <g key={k}>
            <line x1={ML + k * CELL} x2={ML + k * CELL} y1={MT} y2={MT + CELL * 5} stroke={UI.border} />
            <line x1={ML} x2={ML + CELL * 5} y1={MT + k * CELL} y2={MT + k * CELL} stroke={UI.border} />
          </g>
        ))}
        <line x1={mid} x2={mid} y1={MT} y2={MT + CELL * 5} stroke={UI.borderStrong} strokeDasharray="3 3" />
        <line x1={ML} x2={ML + CELL * 5} y1={midY} y2={midY} stroke={UI.borderStrong} strokeDasharray="3 3" />
        {TECH_QUADRANTS.map((q) => (
          <text key={q.id} x={q.x === 'left' ? ML + 4 : ML + CELL * 5 - 4} y={q.y === 'top' ? MT + 11 : MT + CELL * 5 - 5}
            textAnchor={q.x === 'left' ? 'start' : 'end'} fontSize={8.5} fontWeight={700} letterSpacing={0.4}
            fill={q.id === 'quick' ? 'oklch(0.45 0.12 155)' : UI.inkFaint} style={{ textTransform: 'uppercase', pointerEvents: 'none' }}>
            {q.label}
          </text>
        ))}
        {[1, 2, 3, 4, 5].map((n) => (
          <g key={n} fontSize={9.5} fill={UI.inkFaint}>
            <text x={cx(n)} y={MT + CELL * 5 + 12} textAnchor="middle">{n}</text>
            <text x={ML - 7} y={cy(n) + 3} textAnchor="end">{n}</text>
          </g>
        ))}
        <text x={ML + CELL * 2.5} y={H - 3} textAnchor="middle" fontSize={9} fontWeight={700} fill={UI.inkMuted} letterSpacing={0.5}>
          05 TTV → HURTIGERE
        </text>
        <text transform={`translate(9 ${MT + CELL * 2.5}) rotate(-90)`} textAnchor="middle" fontSize={9} fontWeight={700} fill={UI.inkMuted} letterSpacing={0.5}>
          01 VÆRDI → HØJERE
        </text>
        {/* Target cell while dragging */}
        {dropCell && (
          <rect x={ML + (dropCell.t - 1) * CELL + 1} y={MT + (5 - dropCell.v) * CELL + 1} width={CELL - 2} height={CELL - 2}
            fill="none" stroke={UI.accent} strokeWidth={2} rx={3} style={{ pointerEvents: 'none' }} />
        )}
        {dots.map(({ row, x, y, r }) => {
          const id = row.init.id;
          const color = resolveStatus(row.init.status, statuses).color;
          const sel = id === selectedId, hov = id === hoverId;
          const isDragged = dragging && drag.id === id;
          return (
            <g key={id} style={{ cursor: dragging ? 'grabbing' : 'grab', opacity: isDragged ? 0.3 : row.init.rejected ? 0.45 : 1 }}
              onMouseEnter={() => setHoverId(id)} onMouseLeave={() => setHoverId(null)}
              onPointerDown={startDrag(id)}>
              <title>{`${row.prio}. ${row.init.name} — Værdi ${TECH_SCORE.value(row.init)}, TTV ${TECH_SCORE.ttv(row.init)}. Klik for at finde rækken, træk for at ændre scoren.`}</title>
              <circle cx={x} cy={y} r={r + (sel || hov ? 1.5 : 0)} fill={color}
                stroke={sel ? UI.ink : '#fff'} strokeWidth={sel ? 2 : 1.2} />
              {r >= 6.5 && (
                <text x={x} y={y + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#fff" style={{ pointerEvents: 'none' }}>
                  {row.prio}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: hover || dropCell ? UI.ink : UI.inkFaint, minHeight: 16, maxWidth: W, lineHeight: 1.4 }}>
        {dragInit
          ? (dropCell
              ? <><b>{dragInit.init.name}</b> → Værdi {dropCell.v}, TTV {dropCell.t}</>
              : <>Slip i et felt for at sætte værdi og TTV — Esc fortryder.</>)
          : hover
            ? <><span style={{ fontFamily: UI.mono, fontWeight: 700 }}>{hover.prio}.</span> {hover.init.name}</>
            : 'Klik på en prik for at finde rækken — træk den for at ændre scoren.'}
      </div>

      {/* Tray: initiatives missing value and/or TTV, draggable into the grid */}
      {unscored > 0 && (
        <div style={{ maxWidth: W }}>
          <div style={{ fontFamily: UI.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: UI.inkFaint, margin: '2px 0 5px' }}>
            Mangler score · {unscored} af {rows.length}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {unscoredRows.map((row) => {
              const i = row.init;
              const color = resolveStatus(i.status, statuses).color;
              const v = TECH_SCORE.value(i), t = TECH_SCORE.ttv(i);
              const isDragged = dragging && drag.id === i.id;
              return (
                <div key={i.id} onPointerDown={startDrag(i.id)}
                  title={`${i.name} — Værdi ${v ?? '–'}, TTV ${t ?? '–'}. Træk ind i matrixen for at sætte begge scorer.`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%',
                    padding: '2px 8px 2px 4px', borderRadius: 99, fontSize: 10.5, color: UI.ink,
                    border: `1px solid ${i.id === selectedId ? UI.ink : UI.border}`, background: UI.panel,
                    cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none',
                    opacity: isDragged ? 0.35 : 1,
                  }}>
                  <span style={{
                    width: 15, height: 15, borderRadius: 99, background: color, color: '#fff', flexShrink: 0,
                    fontFamily: UI.mono, fontSize: 8.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{row.prio}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{i.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ghost following the pointer */}
      {dragInit && (
        <div style={{
          position: 'fixed', left: drag.x + 10, top: drag.y + 10, zIndex: 1000, pointerEvents: 'none',
          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: UI.sans,
          background: UI.ink, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', whiteSpace: 'nowrap',
        }}>
          {dragInit.prio}. {dragInit.init.name}{dropCell ? ` · V${dropCell.v} T${dropCell.t}` : ''}
        </div>
      )}
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
function UiTechSummary({ rows }) {
  const inits = rows.map((r) => r.init);
  const avg = (key) => {
    const s = inits.map(TECH_SCORE[key]).filter((v) => v != null);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  };
  const both = inits.filter((i) => TECH_SCORE.combined(i) != null).length;
  const ready = inits.filter((i) => i.assessment?.readiness?.ready).length;
  const quick = inits.filter((i) => techQuadrant(i) === 'quick').length;
  const stat = (label, value, sub) => (
    <div style={{ padding: '10px 12px', border: `1px solid ${UI.border}`, borderRadius: 8, background: UI.panel, minWidth: 0 }}>
      <div style={{ fontFamily: UI.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: UI.inkFaint }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 650, color: UI.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: UI.inkFaint, marginTop: 1 }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, alignContent: 'start' }}>
      {stat('Initiativer', inits.length)}
      {stat('Vurderet', `${both}/${inits.length}`, 'har både værdi og TTV')}
      {stat('Ø Værdi', fmtScore(avg('value')), 'af 5')}
      {stat('Ø TTV', fmtScore(avg('ttv')), 'af 5')}
      {stat('Governance-klar', `${ready}/${inits.length}`)}
      {stat('Hurtige gevinster', quick, 'værdi og TTV ≥ 4')}
    </div>
  );
}

// ── Technology comparison ─────────────────────────────────────────────────────
// One row per technology: number of initiatives (bar), how many have both scores,
// and the average Samlet (mean of Værdi and TTV) on a 1–5 track. Respects the status
// filter but not the technology selection; clicking a row toggles that technology.
function UiTechCompare({ store, statusIds, techIds, onToggle, showRejected }) {
  const inits = (store.initiatives || []).filter((i) =>
    (showRejected || !i.rejected) && (!statusIds.size || statusIds.has(i.status)));
  const rows = (store.technologies || []).map((t) => {
    const list = inits.filter((i) => (i.techIds || []).includes(t.id));
    const scores = list.map(TECH_SCORE.combined).filter((v) => v != null);
    return {
      tech: t, n: list.length, scored: scores.length,
      avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      quick: list.filter((i) => techQuadrant(i) === 'quick').length,
    };
  }).sort((a, b) => b.n - a.n || (b.avg ?? 0) - (a.avg ?? 0) || String(a.tech.name).localeCompare(String(b.tech.name), 'da'));
  const maxN = Math.max(1, ...rows.map((r) => r.n));
  const head = { fontFamily: UI.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: UI.inkFaint };
  const grid = { display: 'grid', gridTemplateColumns: 'minmax(110px, 180px) minmax(80px, 1fr) minmax(110px, 1fr) 54px', gap: 10, alignItems: 'center' };

  return (
    <div style={{ marginBottom: 16, padding: '12px 14px', border: `1px solid ${UI.border}`, borderRadius: 8, background: UI.panel, overflowX: 'auto' }}>
      <div style={{ minWidth: 420 }}>
        <div style={{ ...grid, marginBottom: 6 }}>
          <div style={head}>Teknologi</div>
          <div style={head}>Initiativer</div>
          <div style={head} title="Gennemsnit af Værdi og TTV for initiativer med begge scorer">Ø Samlet (1–5)</div>
          <div style={{ ...head, textAlign: 'right' }} title="Værdi og TTV ≥ 4">Hurtige</div>
        </div>
        {rows.map(({ tech, n, scored, avg, quick }) => {
          const on = techIds.has(tech.id);
          return (
            <div key={tech.id} role="button" tabIndex={0} aria-pressed={on}
              onClick={() => onToggle(tech.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(tech.id); } }}
              title={on ? 'Klik for at fravælge' : 'Klik for at vælge teknologien'}
              style={{ ...grid, padding: '4px 6px', margin: '0 -6px', borderRadius: 5, cursor: 'pointer', background: on ? UI.panelSoft : 'transparent' }}>
              <div style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: n ? UI.ink : UI.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {on ? '✓ ' : ''}{tech.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 8, background: 'oklch(0.94 0.005 80)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(n / maxN) * 100}%`, height: '100%', background: on ? UI.ink : UI.inkMuted, opacity: on ? 0.85 : 0.45 }} />
                </div>
                <span style={{ fontFamily: UI.mono, fontSize: 11, fontWeight: 700, color: UI.ink, minWidth: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={n ? `${scored} af ${n} har både værdi og TTV` : undefined}>
                <div style={{ flex: 1, height: 8, background: 'oklch(0.94 0.005 80)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                  {avg != null && (
                    <div style={{
                      width: `${((avg - 1) / 4) * 100}%`, minWidth: 3, height: '100%',
                      background: avg >= 4 ? 'oklch(0.62 0.13 155)' : UI.accent, opacity: 0.8,
                    }} />
                  )}
                </div>
                <span style={{ fontFamily: UI.mono, fontSize: 11, fontWeight: 700, color: avg == null ? UI.inkFaint : UI.ink, minWidth: 22, textAlign: 'right' }}>{fmtScore(avg)}</span>
                <span style={{ fontFamily: UI.mono, fontSize: 9.5, color: UI.inkFaint, minWidth: 26 }}>{n ? `${scored}/${n}` : ''}</span>
              </div>
              <div style={{ fontFamily: UI.mono, fontSize: 11, fontWeight: 700, textAlign: 'right', color: quick ? 'oklch(0.42 0.13 155)' : UI.inkFaint }}>{quick || '–'}</div>
            </div>
          );
        })}
        <div style={{ fontSize: 10.5, color: UI.inkFaint, marginTop: 8, lineHeight: 1.5 }}>
          {statusIds.size ? 'Med det valgte statusfilter. ' : 'Alle statusser. '}
          {showRejected ? 'Afviste idéer tæller med. ' : 'Afviste idéer er ikke med. '}
          Et initiativ med flere teknologier tæller med under hver af dem. Klik på en række for at vælge eller fravælge teknologien.
        </div>
      </div>
    </div>
  );
}

function UiTechInitiativesView({ store, onOpenInit, onRankOrder, onUpdateAssess }) {
  const techs = store?.technologies || [];
  const defaultTech = techs.find((t) => t.name?.trim() === 'Claude') || techs[0];
  const [techIds, setTechIds] = React.useState(() => new Set(defaultTech ? [defaultTech.id] : []));
  const [statusIds, setStatusIds] = React.useState(() => new Set()); // empty = all statuses
  const [sortKey, setSortKey] = React.useState('rank');
  const [sortDir, setSortDir] = React.useState('desc');
  const [selectedId, setSelectedId] = React.useState(null);
  const [rowDrag, setRowDrag] = React.useState(null);   // { id, overId, after } while dragging a row
  const [showRejected, setShowRejected] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(() => {
    try { return localStorage.getItem('aiboard:tech-compare') === '1'; } catch { return false; }
  });
  const tableRef = React.useRef(null);

  // Scroll the selected row into view (selection comes from the matrix).
  React.useEffect(() => {
    if (!selectedId || !tableRef.current) return;
    const row = tableRef.current.querySelector(`[data-init-id="${CSS.escape(selectedId)}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  if (!store) return null;

  const statuses = (store.statuses && store.statuses.length) ? store.statuses : STATUSES;

  const toggleIn = (setter) => (id) => setter((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleTech = toggleIn(setTechIds);
  const toggleStatus = toggleIn(setStatusIds);

  // Initiatives using any of the selected technologies, then the status filter.
  // Rejected ideas (`rejected: { at, reason }`, set in Idéer) are left out unless "Vis afviste" is on;
  // they stay in the global order so moving a neighbour doesn't disturb their rank.
  const allOrdered = [...(store.initiatives || [])].sort(compareRank);
  const rejectedInTech = allOrdered.filter((i) => i.rejected && (i.techIds || []).some((t) => techIds.has(t))).length;
  const inTech     = allOrdered.filter((i) => (showRejected || !i.rejected) && (i.techIds || []).some((t) => techIds.has(t)));
  const shown      = statusIds.size ? inTech.filter((i) => statusIds.has(i.status)) : inTech;
  const multi      = techIds.size > 1;
  const canReorder = sortKey === 'rank';
  // prio = position in priority order among the shown initiatives; stays the same when sorting by score.
  const ranked     = shown.map((init, k) => ({ init, prio: k + 1 }));
  const prioById   = Object.fromEntries(ranked.map((r) => [r.init.id, r.prio]));
  const visible    = canReorder ? ranked : sortByScore(shown, sortKey, sortDir).map((init) => ({ init, prio: prioById[init.id] }));
  const statusCount = (id) => inTech.filter((i) => i.status === id).length;
  const selectedVisible = selectedId && prioById[selectedId] ? selectedId : null;

  // Drag-and-drop: put the dragged initiative just before/after the target in the global order.
  // Everything else keeps its relative position (and its rank), so only the moved initiative
  // changes — hidden initiatives are not reshuffled.
  const dropRow = (dragId, targetId, after) => {
    if (!dragId || dragId === targetId) return;
    const before = allOrdered.map((i) => i.id);
    const ids = before.filter((x) => x !== dragId);
    const k = ids.indexOf(targetId);
    if (k < 0) return;
    ids.splice(after ? k + 1 : k, 0, dragId);
    if (ids.some((x, n) => x !== before[n])) onRankOrder(ids, dragId);
  };

  // ↑↓: jump over the neighbour in the shown list (placed just above/below it).
  const moveRank = (id, dir) => {
    const pos = shown.findIndex((i) => i.id === id);
    const neighbour = shown[pos + dir];
    if (pos < 0 || !neighbour) return;
    dropRow(id, neighbour.id, dir > 0);
  };

  // Both scores from one matrix drop; stop after the first call in view-only mode (it opens the connect prompt).
  const setScores = (id, v, t) => {
    if (onUpdateAssess(id, 'value', { score: v }) === false) return;
    onUpdateAssess(id, 'ttv', { score: t });
  };

  const toggleCompare = () => setCompareOpen((o) => {
    try { localStorage.setItem('aiboard:tech-compare', o ? '0' : '1'); } catch {}
    return !o;
  });

  const clickSort = (key) => {
    if (sortKey === key) {
      if (key === 'rank') return;
      // desc → asc → back to priority order
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortKey('rank'); setSortDir('desc'); }
    } else { setSortKey(key); setSortDir('desc'); }
  };

  const th = (label, key, extra = {}, title) => (
    <th onClick={key ? () => clickSort(key) : undefined} title={title} style={{
      padding: '8px 10px', textAlign: 'left', fontFamily: UI.mono, fontSize: 10, fontWeight: 700,
      letterSpacing: 0.6, textTransform: 'uppercase', color: sortKey === key ? UI.ink : UI.inkFaint,
      borderBottom: `1px solid ${UI.border}`, whiteSpace: 'nowrap', background: UI.panelSoft,
      position: 'sticky', top: 0, zIndex: 1,
      cursor: key ? 'pointer' : 'default', userSelect: 'none', ...extra,
    }}>
      {label}{key && key !== 'rank' && sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
    </th>
  );

  const td = { padding: '9px 10px', borderBottom: `1px solid ${UI.border}`, verticalAlign: 'top', fontSize: 12, color: UI.ink };

  const arrowBtn = (label, disabled, onClick, title) => (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={title} style={{
      border: `1px solid ${UI.border}`, background: UI.panel, color: disabled ? UI.inkFaint : UI.inkMuted,
      borderRadius: 4, width: 22, height: 20, fontSize: 10, lineHeight: 1, padding: 0,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
    }}>{label}</button>
  );

  const sectionLabel = (text) => (
    <div style={{
      fontFamily: UI.mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
      color: UI.inkMuted, marginBottom: 7,
    }}>{text}</div>
  );

  const chip = (key, label, on, onClick, opts = {}) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={on} disabled={opts.disabled} style={{
      padding: '5px 12px', fontSize: 12, fontFamily: UI.sans, fontWeight: 600, borderRadius: 99,
      border: `1px solid ${on ? (opts.color || UI.ink) : `color-mix(in oklch, ${opts.color || UI.ink} 30%, transparent)`}`,
      background: on ? (opts.color || UI.ink) : UI.panel,
      boxShadow: on ? 'none' : '0 1px 1px rgba(0,0,0,0.05)',
      color: on ? '#fff' : (opts.color || UI.ink), cursor: opts.disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
      opacity: opts.disabled ? 0.45 : 1,
    }}>{on ? '✓ ' : ''}{label}</button>
  );

  const clearBtn = (onClick) => (
    <button type="button" onClick={onClick} style={{
      border: 'none', background: 'transparent', padding: '4px 6px', cursor: 'pointer',
      fontSize: 11, color: UI.inkFaint, textDecoration: 'underline',
    }}>Ryd</button>
  );

  const selectedTechNames = techs.filter((t) => techIds.has(t.id)).map((t) => t.name);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 20, fontFamily: UI.sans, minWidth: 0 }}>
      {sectionLabel('Vælg én eller flere teknologier')}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {techs.map((t) => chip(t.id, t.name, techIds.has(t.id), () => toggleTech(t.id)))}
        {techIds.size > 0 && clearBtn(() => setTechIds(new Set()))}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={toggleCompare} aria-expanded={compareOpen} style={{
          border: `1px solid ${UI.border}`, background: compareOpen ? UI.panelSoft : UI.panel, borderRadius: 6,
          padding: '4px 10px', fontSize: 11, fontWeight: 600, color: UI.inkMuted, cursor: 'pointer', fontFamily: UI.sans,
        }}>{compareOpen ? '▾' : '▸'} Sammenlign teknologier</button>
      </div>
      {compareOpen && (
        <UiTechCompare store={store} statusIds={statusIds} techIds={techIds} onToggle={toggleTech} showRejected={showRejected} />
      )}

      {(inTech.length > 0 || rejectedInTech > 0) && (
        <>
          {sectionLabel('Status')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {statuses.map((s) => {
              const n = statusCount(s.id);
              const on = statusIds.has(s.id);
              return chip(s.id, `${s.label} · ${n}`, on, () => toggleStatus(s.id), { color: s.color, disabled: n === 0 && !on });
            })}
            {statusIds.size > 0 && clearBtn(() => setStatusIds(new Set()))}
            {rejectedInTech > 0 && (
              <label title="Idéer der er afvist i Idéer-visningen. Skjult som standard." style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 8, fontSize: 11.5,
                color: UI.inkMuted, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
              }}>
                <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} style={{ margin: 0 }} />
                Vis afviste · {rejectedInTech}
              </label>
            )}
          </div>
        </>
      )}

      {inTech.length === 0 ? (
        <div style={{ color: UI.inkFaint, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          {techIds.size === 0
            ? 'Vælg en eller flere teknologier ovenfor.'
            : rejectedInTech > 0
              ? `Kun afviste idéer bruger ${multi ? 'de valgte teknologier' : 'denne teknologi'} — sæt flueben i "Vis afviste" for at se dem.`
              : multi ? 'Ingen initiativer bruger de valgte teknologier endnu.' : 'Ingen initiativer bruger denne teknologi endnu.'}
        </div>
      ) : shown.length === 0 ? (
        <div style={{ color: UI.inkFaint, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Ingen initiativer med den valgte status.
        </div>
      ) : (
        <>
          {/* Overview: matrix + key figures */}
          <div style={{
            display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18,
            padding: 14, border: `1px solid ${UI.border}`, borderRadius: 8, background: UI.panel,
          }}>
            <div>
              {sectionLabel('Værdi × time-to-value')}
              <UiValueTtvMatrix rows={ranked} statuses={statuses} selectedId={selectedVisible} onSelect={setSelectedId} onScore={setScores} />
            </div>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              {sectionLabel('Overblik')}
              <UiTechSummary rows={ranked} />
              <div style={{ fontSize: 11, color: UI.inkFaint, lineHeight: 1.5, marginTop: 12 }}>
                Tallet i prikkerne er prioriteten. Farven er status. Grønt felt = værdi og TTV på 4 eller 5. Træk en prik til et andet felt for at ændre scoren.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: UI.mono, fontSize: 11, color: UI.inkFaint }}>
              {shown.length}{shown.length !== inTech.length ? ` af ${inTech.length}` : ''} initiativer
              {!showRejected && rejectedInTech > 0 ? ` · ${rejectedInTech} afviste skjult` : ''}
            </div>
            <div style={{ fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>
              {canReorder
                ? 'Rækkefølgen er prioriteten — træk i ⠿ eller brug ↑↓ for at flytte initiativet.'
                : 'Sorteret efter score — klik "Prio" for at gå tilbage til prioriteten og flytte rækker.'}
            </div>
            <div style={{ fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>Klik på scorer, + og ✓ i vurderings-kolonnerne for at redigere.</div>
            <div style={{ flex: 1 }} />
            <UiButton size="sm" onClick={() => techExportCSV(visible, store, selectedTechNames)}
              title="Hent de viste initiativer med vurderinger som CSV (kan åbnes i Excel)">Eksportér CSV</UiButton>
          </div>

          <div ref={tableRef} style={{ overflow: 'auto', maxHeight: 'calc(100vh - 160px)', border: `1px solid ${UI.border}`, borderRadius: 8, background: UI.panel }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 1060 }}>
              <thead>
                <tr>
                  {th('Prio', 'rank', { width: 44 }, 'Vis i prioritets-rækkefølge')}
                  {th('', null, { width: 46 })}
                  {th('Initiativ', null)}
                  {th('Status', null)}
                  {th('Ejer', null)}
                  {th('Samlet', 'combined', { width: 64 }, 'Gennemsnit af Værdi og TTV — klik for at sortere')}
                  {th('01 Værdi', 'value', { minWidth: 170 }, 'Værdipotentiale — klik for at sortere')}
                  {th('02 Ejerskab', null, { minWidth: 170 })}
                  {th('03 Strategi', null, { minWidth: 170 })}
                  {th('04 Gov.', null, { minWidth: 150 })}
                  {th('05 TTV', 'ttv', { minWidth: 170 }, 'Time-to-value (5 = hurtigst) — klik for at sortere')}
                </tr>
              </thead>
              <tbody>
                {visible.map(({ init: i, prio }) => {
                  const bu = (store.businessUnits || []).find((b) => b.id === i.buId);
                  const a = i.assessment || {};
                  const pos = prio - 1;
                  const sel = i.id === selectedVisible;
                  const combined = TECH_SCORE.combined(i);
                  const quick = techQuadrant(i) === 'quick';
                  const update = (key, sub) => onUpdateAssess(i.id, key, sub);
                  const comments = (key) => (
                    <UiComments compact comments={commentsOf(a[key])} onChange={(next) => update(key, { comments: next })} />
                  );
                  // Drop indicator: a line above or below the row under the pointer.
                  const dropHere = rowDrag && rowDrag.overId === i.id && rowDrag.id !== i.id;
                  const dropLine = dropHere ? `inset 0 ${rowDrag.after ? -2 : 2}px 0 ${UI.accent}` : null;
                  const baseTd = sel ? { ...td, background: 'oklch(0.96 0.03 250)' } : td;
                  const rowTd = dropLine ? { ...baseTd, boxShadow: dropLine } : baseTd;
                  const isDragged = rowDrag && rowDrag.id === i.id;
                  return (
                    <tr key={i.id} data-init-id={i.id} style={{ opacity: isDragged ? 0.4 : i.rejected ? 0.6 : 1 }}
                      onClick={(e) => {
                        // Clicking empty row space toggles the highlight; controls keep their own behaviour.
                        if (e.target.closest('button, textarea, input, a')) return;
                        setSelectedId(sel ? null : i.id);
                      }}
                      onDragOver={(e) => {
                        if (!rowDrag) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const box = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > box.top + box.height / 2;
                        if (rowDrag.overId !== i.id || rowDrag.after !== after) setRowDrag({ ...rowDrag, overId: i.id, after });
                      }}
                      onDrop={(e) => {
                        if (!rowDrag) return;
                        e.preventDefault();
                        dropRow(rowDrag.id, i.id, rowDrag.after);
                        setRowDrag(null);
                      }}>
                      <td style={{ ...rowTd, fontFamily: UI.mono, fontWeight: 700, color: UI.inkMuted,
                        boxShadow: [sel && `inset 3px 0 0 ${UI.accent}`, dropLine].filter(Boolean).join(', ') || 'none' }}>
                        {prio}
                      </td>
                      <td style={rowTd}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span draggable={canReorder} aria-hidden="true"
                            title={canReorder ? 'Træk for at flytte initiativet' : 'Klik "Prio" for at kunne flytte rækker'}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', i.name || i.id);
                              const tr = e.currentTarget.closest('tr');
                              if (tr && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(tr, 20, 16);
                              setRowDrag({ id: i.id, overId: null, after: false });
                            }}
                            onDragEnd={() => setRowDrag(null)}
                            style={{
                              fontSize: 14, lineHeight: 1, color: UI.inkFaint, padding: '2px 1px', userSelect: 'none',
                              cursor: canReorder ? 'grab' : 'default', opacity: canReorder ? 1 : 0.3,
                            }}>⠿</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {arrowBtn('▲', !canReorder || pos === 0, () => moveRank(i.id, -1), 'Flyt op')}
                            {arrowBtn('▼', !canReorder || pos === shown.length - 1, () => moveRank(i.id, 1), 'Flyt ned')}
                          </div>
                        </div>
                      </td>
                      <td style={rowTd}>
                        <button onClick={() => onOpenInit && onOpenInit(i)} title="Åbn initiativet" style={{
                          border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left',
                          fontFamily: UI.sans, fontSize: 12.5, fontWeight: 600, color: UI.ink,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          {bu && <UiBuDot bu={bu} />}
                          {i.name}
                        </button>
                        {i.rejected && (
                          <div title={i.rejected.reason || undefined} style={{ fontSize: 10.5, color: UI.inkFaint, marginTop: 3 }}>
                            <span style={{ fontFamily: UI.mono, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', fontSize: 9.5 }}>Afvist</span>
                            {i.rejected.at ? ` ${i.rejected.at}` : ''}{i.rejected.reason ? ` — ${i.rejected.reason}` : ''}
                          </div>
                        )}
                        {/* With several technologies selected, show which of them this initiative uses. */}
                        {multi && (
                          <div style={{ fontFamily: UI.mono, fontSize: 9.5, color: UI.inkFaint, marginTop: 3 }}>
                            {techs.filter((t) => techIds.has(t.id) && (i.techIds || []).includes(t.id)).map((t) => t.name).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td style={rowTd}><UiStatusPill status={i.status} statuses={store.statuses} size="sm" /></td>
                      <td style={{ ...rowTd, color: UI.inkMuted, whiteSpace: 'nowrap' }}>{i.owner || '–'}</td>
                      <td style={rowTd}>
                        <span title={quick ? 'Hurtig gevinst: værdi og TTV ≥ 4' : undefined} style={{
                          display: 'inline-block', minWidth: 30, textAlign: 'center', padding: '2px 6px', borderRadius: 4,
                          fontFamily: UI.mono, fontSize: 11.5, fontWeight: 700,
                          color: combined == null ? UI.inkFaint : quick ? 'oklch(0.40 0.12 155)' : UI.ink,
                          background: quick ? 'oklch(0.94 0.05 155)' : combined == null ? 'transparent' : UI.panelSoft,
                        }}>{fmtScore(combined)}</span>
                      </td>
                      <td style={rowTd}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <UiScoreEditor score={a.value?.score ?? null} onChange={(v) => update('value', { score: v })} />
                          {comments('value')}
                        </div>
                      </td>
                      <td style={rowTd}>{comments('ownership')}</td>
                      <td style={rowTd}>{comments('strategy')}</td>
                      <td style={rowTd}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button type="button" title={a.readiness?.ready ? 'Governance-klar — klik for at fjerne' : 'Klik for at markere governance-klar'}
                            onClick={() => update('readiness', { ready: !a.readiness?.ready })} style={{
                              alignSelf: 'flex-start', cursor: 'pointer', fontFamily: UI.sans,
                              fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                              border: `1px solid ${a.readiness?.ready ? 'oklch(0.75 0.10 155)' : UI.border}`,
                              background: a.readiness?.ready ? 'oklch(0.95 0.04 155)' : 'transparent',
                              color: a.readiness?.ready ? 'oklch(0.42 0.13 155)' : UI.inkFaint,
                            }}>{a.readiness?.ready ? '✓ Klar' : 'Ikke klar'}</button>
                          {comments('readiness')}
                        </div>
                      </td>
                      <td style={rowTd}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <UiScoreEditor score={a.ttv?.score ?? null} onChange={(v) => update('ttv', { score: v })} />
                          {comments('ttv')}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { UiTechInitiativesView, techRankUpdates });
