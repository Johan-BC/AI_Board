// ── Technology view: initiatives using one or more selected technologies, with assessment criteria and manual priority ──

// Global priority order: assessment.rank ascending, unranked last, stable on original order.
function compareRank(a, b) {
  const ra = a.assessment?.rank ?? Infinity;
  const rb = b.assessment?.rank ?? Infinity;
  if (ra === rb) return 0;
  return ra < rb ? -1 : 1;
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
  const lines = rows.map(({ init: i, prio }) => {
    const a = i.assessment || {};
    const combined = TECH_SCORE.combined(i);
    return [
      prio, i.name, statusLabel(i.status), i.owner || '', buName(i.buId),
      (i.techIds || []).map(techName).filter(Boolean).join(', '),
      a.value?.score ?? '', a.ttv?.score ?? '', combined == null ? '' : fmtScore(combined),
      a.readiness?.ready ? 'Ja' : 'Nej',
      notes(a.value), notes(a.ownership), notes(a.strategy), notes(a.readiness), notes(a.ttv),
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

function UiValueTtvMatrix({ rows, statuses, selectedId, onSelect }) {
  const [hoverId, setHoverId] = React.useState(null);
  const CELL = 52, ML = 30, MT = 8, MB = 30;
  const W = ML + CELL * 5 + 8, H = MT + CELL * 5 + MB;
  const cx = (t) => ML + (t - 1) * CELL + CELL / 2;   // TTV → x
  const cy = (v) => MT + (5 - v) * CELL + CELL / 2;   // Værdi → y (5 at the top)

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
  const unscored = rows.length - dots.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', fontFamily: UI.mono }}
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
        {dots.map(({ row, x, y, r }) => {
          const id = row.init.id;
          const color = resolveStatus(row.init.status, statuses).color;
          const sel = id === selectedId, hov = id === hoverId;
          return (
            <g key={id} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverId(id)} onMouseLeave={() => setHoverId(null)}
              onClick={() => onSelect(sel ? null : id)}>
              <title>{`${row.prio}. ${row.init.name} — Værdi ${TECH_SCORE.value(row.init)}, TTV ${TECH_SCORE.ttv(row.init)}`}</title>
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
      <div style={{ fontSize: 11, color: hover ? UI.ink : UI.inkFaint, minHeight: 16, maxWidth: W, lineHeight: 1.4 }}>
        {hover
          ? <><span style={{ fontFamily: UI.mono, fontWeight: 700 }}>{hover.prio}.</span> {hover.init.name}</>
          : unscored > 0
            ? `${unscored} af ${rows.length} mangler score for værdi og/eller TTV.`
            : 'Klik på et initiativ for at finde det i tabellen.'}
      </div>
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

function UiTechInitiativesView({ store, onOpenInit, onRankOrder, onUpdateAssess }) {
  const techs = store?.technologies || [];
  const defaultTech = techs.find((t) => t.name?.trim() === 'Claude') || techs[0];
  const [techIds, setTechIds] = React.useState(() => new Set(defaultTech ? [defaultTech.id] : []));
  const [statusIds, setStatusIds] = React.useState(() => new Set()); // empty = all statuses
  const [sortKey, setSortKey] = React.useState('rank');
  const [sortDir, setSortDir] = React.useState('desc');
  const [selectedId, setSelectedId] = React.useState(null);
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
  const allOrdered = [...(store.initiatives || [])].sort(compareRank);
  const inTech     = allOrdered.filter((i) => (i.techIds || []).some((t) => techIds.has(t)));
  const shown      = statusIds.size ? inTech.filter((i) => statusIds.has(i.status)) : inTech;
  const multi      = techIds.size > 1;
  const canReorder = sortKey === 'rank';
  // prio = position in priority order among the shown initiatives; stays the same when sorting by score.
  const ranked     = shown.map((init, k) => ({ init, prio: k + 1 }));
  const prioById   = Object.fromEntries(ranked.map((r) => [r.init.id, r.prio]));
  const visible    = canReorder ? ranked : sortByScore(shown, sortKey, sortDir).map((init) => ({ init, prio: prioById[init.id] }));
  const statusCount = (id) => inTech.filter((i) => i.status === id).length;
  const selectedVisible = selectedId && prioById[selectedId] ? selectedId : null;

  // Swap with the neighbour in the shown list; the global order of everything else is kept.
  const moveRank = (id, dir) => {
    const pos = shown.findIndex((i) => i.id === id);
    const neighbour = shown[pos + dir];
    if (pos < 0 || !neighbour) return;
    const ids = allOrdered.map((i) => i.id);
    const a = ids.indexOf(id), b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    onRankOrder(ids);
  };

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
      </div>

      {inTech.length > 0 && (
        <>
          {sectionLabel('Status')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {statuses.map((s) => {
              const n = statusCount(s.id);
              const on = statusIds.has(s.id);
              return chip(s.id, `${s.label} · ${n}`, on, () => toggleStatus(s.id), { color: s.color, disabled: n === 0 && !on });
            })}
            {statusIds.size > 0 && clearBtn(() => setStatusIds(new Set()))}
          </div>
        </>
      )}

      {inTech.length === 0 ? (
        <div style={{ color: UI.inkFaint, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          {techIds.size === 0
            ? 'Vælg en eller flere teknologier ovenfor.'
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
              <UiValueTtvMatrix rows={ranked} statuses={statuses} selectedId={selectedVisible} onSelect={setSelectedId} />
            </div>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              {sectionLabel('Overblik')}
              <UiTechSummary rows={ranked} />
              <div style={{ fontSize: 11, color: UI.inkFaint, lineHeight: 1.5, marginTop: 12 }}>
                Tallet i prikkerne er prioriteten. Farven er status. Grønt felt = værdi og TTV på 4 eller 5.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: UI.mono, fontSize: 11, color: UI.inkFaint }}>
              {shown.length}{shown.length !== inTech.length ? ` af ${inTech.length}` : ''} initiativer
            </div>
            <div style={{ fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>
              {canReorder
                ? 'Rækkefølgen er prioriteten — ↑↓ flytter initiativet.'
                : 'Sorteret efter score — klik "Prio" for at gå tilbage til prioriteten og bruge ↑↓.'}
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
                  {th('', null, { width: 30 })}
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
                  const rowTd = sel ? { ...td, background: 'oklch(0.96 0.03 250)' } : td;
                  return (
                    <tr key={i.id} data-init-id={i.id} onClick={(e) => {
                      // Clicking empty row space toggles the highlight; controls keep their own behaviour.
                      if (e.target.closest('button, textarea, input, a')) return;
                      setSelectedId(sel ? null : i.id);
                    }}>
                      <td style={{ ...rowTd, fontFamily: UI.mono, fontWeight: 700, color: UI.inkMuted, boxShadow: sel ? `inset 3px 0 0 ${UI.accent}` : 'none' }}>
                        {prio}
                      </td>
                      <td style={rowTd}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {arrowBtn('▲', !canReorder || pos === 0, () => moveRank(i.id, -1), 'Flyt op')}
                          {arrowBtn('▼', !canReorder || pos === shown.length - 1, () => moveRank(i.id, 1), 'Flyt ned')}
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

Object.assign(window, { UiTechInitiativesView });
