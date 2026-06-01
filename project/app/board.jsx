// AI Initiative Board — BU swim lanes, full-width Gantt.
// Technologies + Blockers live in a compact horizontal strip above the Gantt.

// ── Date helpers ──────────────────────────────────────────────────────────────
const D_MS = 86400000;
function parseISO(s) { const [y, m, d] = String(s || '').split('-').map(Number); return new Date(y, m - 1, d); }
function dateToISO(d) { return d.toISOString().slice(0, 10); }
function fmtMon(d) { return d.toLocaleString('en-US', { month: 'short' }); }
function fmtDay(d) { return d.toLocaleString('en-US', { month: 'short', day: 'numeric' }); }
function quarterOf(d) { return Math.floor(d.getMonth() / 3) + 1; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

function chipBtn(active, small, color) {
  const c = color || UI.ink;
  return {
    padding: small ? '3px 8px' : '5px 10px', fontSize: 11,
    fontFamily: small ? UI.mono : UI.sans, fontWeight: 500,
    borderRadius: small ? 4 : 99,
    border: `1px solid ${active ? c : UI.border}`,
    background: active ? c : 'transparent',
    color: active ? '#fff' : UI.inkMuted,
    cursor: 'pointer', lineHeight: 1,
  };
}

function techHue(item) {
  if (item.colorHue != null && !isNaN(item.colorHue)) return item.colorHue;
  return item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

const BLOCKER_RED    = 'oklch(0.52 0.2 15)';
const BLOCKER_RED_BG = 'oklch(0.97 0.04 15)';

// ── Persistence ───────────────────────────────────────────────────────────────
const STORE_KEY = 'aiboard-alt:store:v2';

function readLocalStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && p.initiatives && p.technologies && p.businessUnits && p.blockers) return p;
  } catch (e) {}
  return null;
}

function LoadingScreen({ message }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      background: UI.bg, fontFamily: UI.sans,
    }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${UI.border}`,
        borderTopColor: UI.ink, borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <div style={{ fontSize: 13, color: UI.inkMuted }}>{message || 'Loading…'}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Filter strip — multi-row, no scrollbar, no category labels ───────────────
function FilterStrip({
  store, selectedTechs, selectedBlockers, toggleTech, toggleBlocker,
  techSynergy, blockerSynergy, matchMode, setMatchMode,
  blockerMode, setBlockerMode, filteredInits, matchedSet, blockerMatchedSet,
  onClearTechs, onClearBlockers,
}) {
  const hasTech    = selectedTechs.size > 0;
  const hasBlocker = selectedBlockers.size > 0;
  const totalBlocked = store.initiatives.filter((i) => (i.blockerIds || []).length > 0).length;

  // Chip factory — shared style, no category labels, no badges
  const makeChip = ({ id, name, selected, hue, isBlocker, onToggle, buSize }) => {
    const accentColor = isBlocker ? BLOCKER_RED : `oklch(0.5 0.15 ${hue})`;
    const accentGlow  = isBlocker ? BLOCKER_RED_BG : `oklch(0.5 0.15 ${hue} / 0.22)`;
    // Subtle cross-BU dot shown on unselected chips with 2+ BU synergy
    const showDot = !selected && buSize >= 2;
    return (
      <button key={id} onClick={onToggle}
        title={`${name}${buSize >= 2 ? ` — ${buSize} forretningsenheder` : ''}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
          fontFamily: UI.sans, fontSize: 11.5, fontWeight: selected ? 600 : 400, lineHeight: 1,
          background: selected ? accentColor : UI.panel,
          color: selected ? '#fff' : UI.ink,
          border: `1.5px solid ${selected ? accentColor : UI.border}`,
          boxShadow: selected ? `0 0 0 3px ${accentGlow}` : 'none',
          transition: 'background .1s, border-color .1s, box-shadow .1s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.background = UI.panelSoft; e.currentTarget.style.borderColor = UI.borderStrong; } }}
        onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.background = UI.panel; e.currentTarget.style.borderColor = UI.border; } }}>
        {name}
        {showDot && (
          <span style={{
            width: 5, height: 5, borderRadius: 99, flex: '0 0 auto',
            background: isBlocker
              ? (buSize >= 3 ? 'oklch(0.45 0.2 10)' : 'oklch(0.55 0.18 25)')
              : (buSize >= 3 ? 'oklch(0.52 0.13 150)' : 'oklch(0.62 0.14 70)'),
          }} />
        )}
      </button>
    );
  };

  const techChips = store.technologies.map((t) => makeChip({
    id: t.id, name: t.name, selected: selectedTechs.has(t.id),
    hue: techHue(t), isBlocker: false,
    onToggle: () => toggleTech(t.id),
    buSize: (techSynergy.get(t.id) || new Set()).size,
  }));

  const blockerChips = (store.blockers || []).map((b) => makeChip({
    id: b.id, name: b.name, selected: selectedBlockers.has(b.id),
    hue: 15, isBlocker: true,
    onToggle: () => toggleBlocker(b.id),
    buSize: (blockerSynergy.get(b.id) || new Set()).size,
  }));

  const SectionHeader = ({ label, color, count, onClear, hasSelection, matchCount, totalCount, matchMode, setMatchMode, showMatchToggle }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: UI.mono, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color, fontWeight: 700 }}>{label}</span>
      {hasSelection && (
        <>
          <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint }}>
            {matchCount}/{totalCount} init
          </span>
          {showMatchToggle && (
            <div style={{ display: 'inline-flex', gap: 3 }}>
              {['any', 'all'].map((m) => (
                <button key={m} onClick={() => setMatchMode(m)} style={{
                  padding: '1px 6px', fontSize: 9.5, fontFamily: UI.mono,
                  borderRadius: 3, cursor: 'pointer', lineHeight: 1,
                  border: `1px solid ${matchMode === m ? color : UI.border}`,
                  background: matchMode === m ? color : 'transparent',
                  color: matchMode === m ? '#fff' : UI.inkMuted,
                }}>{m === 'any' ? 'Én' : 'Alle'}</button>
              ))}
            </div>
          )}
          <button onClick={onClear} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: UI.inkFaint, fontFamily: UI.mono, fontSize: 10, padding: '1px 4px', borderRadius: 3,
          }}>× Ryd</button>
        </>
      )}
    </div>
  );

  return (
    <div style={{
      flex: '0 0 auto', borderBottom: `1px solid ${UI.border}`,
      background: UI.panelSoft, display: 'flex', alignItems: 'stretch',
    }}>

      {/* ── Tech section ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '8px 12px', borderRight: `1px solid ${UI.border}` }}>
        <SectionHeader
          label="Teknologier" color={UI.accent}
          hasSelection={hasTech}
          matchCount={matchedSet.size} totalCount={filteredInits.length}
          matchMode={matchMode} setMatchMode={setMatchMode}
          showMatchToggle={selectedTechs.size > 1}
          onClear={onClearTechs}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {techChips}
        </div>
      </div>

      {/* ── Blocker section ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '8px 12px', borderRight: `1px solid ${UI.border}` }}>
        <SectionHeader
          label="⚠ Blockers" color={BLOCKER_RED}
          hasSelection={hasBlocker}
          matchCount={blockerMatchedSet.size} totalCount={filteredInits.length}
          onClear={onClearBlockers}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {blockerChips}
        </div>
      </div>

      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-start', padding: '8px 12px', paddingTop: 28 }}>
        <button onClick={() => setBlockerMode(!blockerMode)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
          borderRadius: 5, lineHeight: 1, whiteSpace: 'nowrap', fontFamily: UI.sans,
          border: `1.5px solid ${blockerMode ? BLOCKER_RED : UI.border}`,
          background: blockerMode ? `color-mix(in oklch, ${BLOCKER_RED} 10%, transparent)` : UI.panel,
          color: blockerMode ? BLOCKER_RED : UI.inkMuted,
        }}>
          <span>⚠</span>
          <span>{blockerMode ? 'Mode ON' : 'Vis blokerede'}</span>
          {!blockerMode && totalBlocked > 0 && (
            <span style={{ background: BLOCKER_RED, color: '#fff', borderRadius: 99, fontSize: 9, padding: '1px 5px', fontWeight: 700 }}>{totalBlocked}</span>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main board component ──────────────────────────────────────────────────────
function BoardView() {
  const [store, setStore]           = React.useState(null);
  const [dataSource, setDataSource] = React.useState('loading');
  const [statusFilter, setStatusFilter] = React.useState(null);
  const [buFilter, setBuFilter]     = React.useState(null);
  const [selectedTechs, setSelectedTechs]       = React.useState(() => new Set());
  const [selectedBlockers, setSelectedBlockers] = React.useState(() => new Set());
  const [matchMode, setMatchMode]   = React.useState('any');
  const [drawer, setDrawer]         = React.useState(null);
  const [zoom, setZoom]             = React.useState(1);
  const [blockerMode, setBlockerMode] = React.useState(false);
  const dragSuppressRef = React.useRef(null);
  const fileInputRef    = React.useRef(null);
  const scrollerRef     = React.useRef(null);

  const applyStore = (s, source) => {
    setStore(s); setDataSource(source);
    setSelectedTechs(new Set()); setSelectedBlockers(new Set());
    setStatusFilter(null); setBuFilter(null); setDrawer(null);
    setBlockerMode(false);
  };

  React.useEffect(() => {
    const saved = readLocalStore();
    if (saved) { applyStore(saved, 'session'); return; }
    // Try ./data.xlsx first (works from root index.html),
    // then ../data.xlsx (works from project/board.html subfolder).
    const tryFetch = (urls) => {
      const [url, ...rest] = urls;
      if (!url) return Promise.reject(new Error('not found'));
      return fetch(url, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer().then((buf) => ({ buf, name: url.split('/').pop() }));
      }).catch(() => tryFetch(rest));
    };
    tryFetch(['./data.xlsx', '../data.xlsx'])
      .then(({ buf, name }) => {
        const parsed = parseExcelBuffer(buf);
        applyStore(parsed, name);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(parsed)); } catch (e) {}
      })
      .catch(() => applyStore(makeStore(), 'built-in seed'));
  }, []);

  React.useEffect(() => {
    if (!store) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
    }, 200);
    return () => clearTimeout(t);
  }, [store]);

  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseExcelBuffer(ev.target.result);
        applyStore(parsed, file.name);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(parsed)); } catch (err) {}
      } catch (err) { alert('Could not read the Excel file: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const reloadExcel = () => {
    if (!confirm('Reload data.xlsx? All unsaved edits will be lost.')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    setStore(null); setDataSource('loading');
    fetch('./data.xlsx')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then((buf) => {
        const parsed = parseExcelBuffer(buf);
        applyStore(parsed, 'data.xlsx');
        try { localStorage.setItem(STORE_KEY, JSON.stringify(parsed)); } catch (e) {}
      })
      .catch((err) => { alert('Could not load data.xlsx: ' + err.message); applyStore(makeStore(), 'built-in seed'); });
  };

  const resetToSeed = () => {
    if (!confirm('Reset to built-in seed data? All edits will be lost.')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    applyStore(makeStore(), 'built-in seed');
  };

  const today = new Date();

  const filteredInits = React.useMemo(() => {
    if (!store) return [];
    return store.initiatives.filter((i) =>
      (!statusFilter || i.status === statusFilter) &&
      (!buFilter     || i.buId === buFilter)
    );
  }, [store, statusFilter, buFilter]);

  const matchedSet = React.useMemo(() => {
    if (!store) return new Set();
    return new Set(filteredInits.filter((i) => {
      if (selectedTechs.size === 0) return true;
      if (matchMode === 'any') return i.techIds.some((t) => selectedTechs.has(t));
      return [...selectedTechs].every((t) => i.techIds.includes(t));
    }).map((i) => i.id));
  }, [filteredInits, selectedTechs, matchMode]);

  const blockerMatchedSet = React.useMemo(() => {
    if (!store || selectedBlockers.size === 0) return new Set();
    return new Set(filteredInits.filter((i) =>
      (i.blockerIds || []).some((b) => selectedBlockers.has(b))
    ).map((i) => i.id));
  }, [filteredInits, selectedBlockers]);

  const techSynergy    = React.useMemo(() => store ? buildSynergyMap(store.initiatives, 'techIds')    : new Map(), [store]);
  const blockerSynergy = React.useMemo(() => store ? buildSynergyMap(store.initiatives, 'blockerIds') : new Map(), [store]);

  const toggleTech    = (id) => setSelectedTechs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBlocker = (id) => setSelectedBlockers((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const range = React.useMemo(() => {
    if (!store) return { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) };
    const dates = store.initiatives.flatMap((i) => [parseISO(i.start), parseISO(i.end)]);
    if (!dates.length) return { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) };
    let lo = dates.reduce((a, b) => a < b ? a : b);
    let hi = dates.reduce((a, b) => a > b ? a : b);
    lo = startOfMonth(new Date(lo.getFullYear(), lo.getMonth() - 3, 1));
    hi = endOfMonth(new Date(hi.getFullYear(), hi.getMonth() + 3, 1));
    return { start: lo, end: hi };
  }, [store]);

  const monthList = React.useMemo(() => {
    const out = []; let cur = new Date(range.start);
    while (cur <= range.end) { out.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
    return out;
  }, [range.start.getTime(), range.end.getTime()]);

  const monthW    = 80 * zoom;
  const labelW    = 240;
  const timelineW = monthList.length * monthW;
  const dayPx     = timelineW / ((range.end - range.start) / D_MS + 1);
  const dateToX   = (d) => ((d - range.start) / D_MS) * dayPx;

  const BU_H = 40, PLAT_H = 28, ROW_H = 44, LANE_GAP = 8;

  const layout = React.useMemo(() => {
    if (!store) return { rows: [], totalH: 0 };
    const rows = []; let y = 0;
    const visibleBUs = store.businessUnits.filter((b) => !buFilter || b.id === buFilter);
    const platforms = store.platforms || [];
    for (const bu of visibleBUs) {
      const items = filteredInits.filter((i) => i.buId === bu.id);
      rows.push({ kind: 'bu', bu, y, h: BU_H, count: items.length });
      y += BU_H;
      // Ungrouped initiatives (no platformId)
      for (const init of items.filter((i) => !i.platformId)) {
        rows.push({ kind: 'init', init, bu, platform: null, y, h: ROW_H });
        y += ROW_H;
      }
      // Platform groups
      for (const platform of platforms.filter((p) => p.buId === bu.id)) {
        const platItems = items.filter((i) => i.platformId === platform.id);
        if (platItems.length === 0) continue;
        rows.push({ kind: 'platform', platform, bu, y, h: PLAT_H });
        y += PLAT_H;
        for (const init of platItems) {
          rows.push({ kind: 'init', init, bu, platform, y, h: ROW_H });
          y += ROW_H;
        }
      }
      y += LANE_GAP;
    }
    return { rows, totalH: y };
  }, [store, filteredInits, buFilter]);

  const buBands = React.useMemo(() => {
    const buRows = layout.rows.filter((r) => r.kind === 'bu');
    return buRows.map((r) => {
      const allInBU = layout.rows.filter((x) => (x.kind === 'bu' || x.kind === 'init' || x.kind === 'platform') && x.bu.id === r.bu.id);
      const last = allInBU[allInBU.length - 1];
      return { buId: r.bu.id, startY: r.y, endY: last.y + last.h };
    });
  }, [layout]);

  const synergyBand = React.useMemo(() => {
    if (selectedTechs.size !== 1 || selectedBlockers.size > 0) return null;
    const techId = [...selectedTechs][0];
    const buSet = techSynergy.get(techId) || new Set();
    if (buSet.size < 2) return null;
    const matched = layout.rows.filter((r) => r.kind === 'init' && r.init.techIds.includes(techId));
    if (matched.length < 2) return null;
    const xs = matched.flatMap((r) => [dateToX(parseISO(r.init.start)), dateToX(parseISO(r.init.end))]);
    const tech = (store.technologies || []).find((t) => t.id === techId);
    return { x1: Math.min(...xs), x2: Math.max(...xs), hue: tech ? techHue(tech) : 250, buCount: buSet.size, kind: 'tech' };
  }, [selectedTechs, selectedBlockers, techSynergy, layout, dayPx, store]);

  const blockerSynergyBand = React.useMemo(() => {
    if (selectedBlockers.size !== 1) return null;
    const blockerId = [...selectedBlockers][0];
    const buSet = blockerSynergy.get(blockerId) || new Set();
    if (buSet.size < 2) return null;
    const matched = layout.rows.filter((r) => r.kind === 'init' && (r.init.blockerIds || []).includes(blockerId));
    if (matched.length < 2) return null;
    const xs = matched.flatMap((r) => [dateToX(parseISO(r.init.start)), dateToX(parseISO(r.init.end))]);
    return { x1: Math.min(...xs), x2: Math.max(...xs), hue: 15, buCount: buSet.size, kind: 'blocker' };
  }, [selectedBlockers, blockerSynergy, layout, dayPx]);

  const activeBand = blockerSynergyBand || synergyBand;

  const platformSpans = React.useMemo(() => {
    const spans = []; const rows = layout.rows;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].kind !== 'platform') continue;
      const platRow = rows[i];
      let lastY = platRow.y + platRow.h;
      for (let j = i + 1; j < rows.length && rows[j].kind === 'init' && rows[j].platform && rows[j].platform.id === platRow.platform.id; j++) {
        lastY = rows[j].y + rows[j].h;
      }
      spans.push({ platform: platRow.platform, bu: platRow.bu, y1: platRow.y, y2: lastY });
    }
    return spans;
  }, [layout]);

  const litTechId    = selectedTechs.size === 1    ? [...selectedTechs][0]    : null;
  const litBlockerId = selectedBlockers.size === 1 ? [...selectedBlockers][0] : null;

  const connectorBars = React.useMemo(() => {
    if (litTechId) {
      return layout.rows
        .filter((r) => r.kind === 'init' && r.init.techIds.includes(litTechId))
        .map((r) => ({ id: r.init.id, buId: r.bu.id, x1: dateToX(parseISO(r.init.start)), x2: dateToX(parseISO(r.init.end)), y: r.y + r.h / 2, isBlocker: false }));
    }
    if (litBlockerId) {
      return layout.rows
        .filter((r) => r.kind === 'init' && (r.init.blockerIds || []).includes(litBlockerId))
        .map((r) => ({ id: r.init.id, buId: r.bu.id, x1: dateToX(parseISO(r.init.start)), x2: dateToX(parseISO(r.init.end)), y: r.y + r.h / 2, isBlocker: true }));
    }
    return [];
  }, [litTechId, litBlockerId, layout, dayPx]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const updateInit = (id, patch) => setStore((s) => ({
    ...s, initiatives: s.initiatives.map((i) => i.id === id ? { ...i, ...patch } : i),
  }));

  const saveInit = (d) => {
    setStore((s) => {
      const exists = s.initiatives.some((i) => i.id === d.id);
      const cleaned = { ...d }; delete cleaned._new;
      if (!cleaned.milestones) cleaned.milestones = [];
      if (!cleaned.blockerIds) cleaned.blockerIds = [];
      const next = exists
        ? s.initiatives.map((i) => i.id === d.id ? cleaned : i)
        : [...s.initiatives, cleaned];
      return { ...s, initiatives: next };
    });
    setDrawer(null);
  };

  const delInit = (id) => {
    setStore((s) => ({ ...s, initiatives: s.initiatives.filter((i) => i.id !== id) }));
    setDrawer(null);
  };

  const newInit = (buId) => setDrawer({
    _new: true, id: 'i_' + Math.random().toString(36).slice(2, 7),
    buId: buId || (store.businessUnits[0] && store.businessUnits[0].id) || 'mkt',
    platformId: null,
    name: '', status: 'idea', owner: '',
    techIds: [], blockerIds: [], tags: [], description: '',
    start: dateToISO(today), end: dateToISO(new Date(today.getTime() + 120 * D_MS)),
    milestones: [],
  });

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e) => e.stopPropagation();
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (!store) return <LoadingScreen message="Loading data…" />;

  const techById = _byId(store.technologies);
  const buById   = _byId(store.businessUnits);
  const totalBlocked = store.initiatives.filter((i) => (i.blockerIds || []).length > 0).length;

  const scrollTo = (date) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTo({ left: Math.max(0, dateToX(date) + labelW - 120), behavior: 'smooth' });
  };
  const scrollByMonths = (delta) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: delta * monthW, behavior: 'smooth' });
  };

  const startBarDrag = (e, init, mode) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const origStart = parseISO(init.start), origEnd = parseISO(init.end);
    let dragged = false;
    const apply = (dx) => {
      const dxDays = Math.round(dx / dayPx);
      if (dxDays === 0) { updateInit(init.id, { start: dateToISO(origStart), end: dateToISO(origEnd) }); return; }
      let ns = origStart, ne = origEnd;
      if (mode === 'move') {
        ns = new Date(origStart.getTime() + dxDays * D_MS);
        ne = new Date(origEnd.getTime()   + dxDays * D_MS);
      } else if (mode === 'rR') {
        ne = new Date(origEnd.getTime() + dxDays * D_MS);
        if (ne <= new Date(origStart.getTime() + 6 * D_MS)) ne = new Date(origStart.getTime() + 7 * D_MS);
      } else if (mode === 'rL') {
        ns = new Date(origStart.getTime() + dxDays * D_MS);
        if (ns >= new Date(origEnd.getTime() - 6 * D_MS)) ns = new Date(origEnd.getTime() - 7 * D_MS);
      }
      const patch = { start: dateToISO(ns), end: dateToISO(ne) };
      if (mode === 'move' && init.milestones && init.milestones.length) {
        patch.milestones = init.milestones.map((m) => ({
          ...m, date: dateToISO(new Date(parseISO(m.date).getTime() + dxDays * D_MS)),
        }));
      }
      updateInit(init.id, patch);
    };
    const onMove = (ev) => { const dx = ev.clientX - startX; if (Math.abs(dx) > 3) dragged = true; if (dragged) apply(dx); };
    const onUp   = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (dragged) {
        dragSuppressRef.current = init.id;
        setTimeout(() => { if (dragSuppressRef.current === init.id) dragSuppressRef.current = null; }, 60);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };
  const onBarClick = (init) => { if (dragSuppressRef.current === init.id) return; setDrawer({ ...init }); };

  const getBarStyle = (init, bu) => {
    const status      = STATUSES.find((st) => st.id === init.status) || STATUSES[0];
    const hasBlockers = (init.blockerIds || []).length > 0;
    const inBlockerMatch = selectedBlockers.size > 0 && blockerMatchedSet.has(init.id);
    const inTechMatch    = selectedTechs.size    > 0 && matchedSet.has(init.id);
    let dim = false, isHot = false, borderLeftColor = status.color, bgOverride = null, glowColor = null;
    if (selectedBlockers.size > 0) {
      dim = !inBlockerMatch; isHot = inBlockerMatch;
      if (isHot) { borderLeftColor = BLOCKER_RED; glowColor = BLOCKER_RED; }
    } else if (selectedTechs.size > 0) {
      dim = !inTechMatch; isHot = inTechMatch;
      if (isHot) glowColor = bu.accent;
    } else if (blockerMode) {
      dim = !hasBlockers;
      if (hasBlockers) { borderLeftColor = BLOCKER_RED; bgOverride = `color-mix(in oklch, ${BLOCKER_RED} 6%, ${UI.panel})`; }
    }
    const boxShadow = isHot && glowColor
      ? `0 0 0 2px ${glowColor}, 0 0 0 4px color-mix(in oklch, ${glowColor} 25%, transparent), 0 6px 16px rgba(20,16,12,.1)`
      : UI.shadow;
    return { status, hasBlockers, dim, isHot, borderLeftColor, bgOverride, boxShadow };
  };

  const isExcel  = dataSource !== 'built-in seed' && dataSource !== 'session' && dataSource !== 'loading';
  const srcColor = isExcel ? 'oklch(0.52 0.13 150)' : dataSource === 'session' ? UI.inkMuted : UI.inkFaint;
  const CAL_H    = 56;

  return (
    <div className="ai-board" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: UI.bg, position: 'relative' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <UiTopBar
        kicker="AI INITIATIV OVERBLIK"
        title="AI Board"
        subtitle="Filtrér på teknologi eller blocker i baren nedenfor — se synergier på tværs af forretningsenheder."
        right={<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, marginRight: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Status</span>
            {[null, ...STATUSES.map((s) => s.id)].map((id) => (
              <button key={id || 'all'} onClick={() => setStatusFilter(id)} style={chipBtn(statusFilter === id)}>
                {id ? STATUSES.find((s) => s.id === id).label : 'All'}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 4px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Enhed</span>
            <select value={buFilter || ''} onChange={(e) => setBuFilter(e.target.value || null)} style={{
              padding: '4px 8px', fontSize: 11, fontFamily: UI.sans, border: `1px solid ${UI.border}`,
              borderRadius: 6, background: UI.panel, color: UI.ink, cursor: 'pointer', outline: 'none',
            }}>
              <option value="">Alle</option>
              {store.businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 4px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => scrollByMonths(-1)} style={chipBtn(false, true)}>‹</button>
            <button onClick={() => scrollTo(today)} style={chipBtn(false, true)}>I dag</button>
            <button onClick={() => scrollByMonths(1)} style={chipBtn(false, true)}>›</button>
            {[0.75, 1, 1.5].map((z) => (
              <button key={z} onClick={() => setZoom(z)} style={chipBtn(zoom === z, true)}>
                {z === 0.75 ? 'S' : z === 1 ? 'M' : 'L'}
              </button>
            ))}
          </div>
          <UiButton variant="primary" onClick={() => newInit()} icon={<span style={{ fontSize: 14, lineHeight: 0 }}>+</span>}>Ny</UiButton>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 2px' }} />
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} title="Import Excel-fil" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            borderRadius: 6, border: `1px solid ${UI.border}`,
            background: UI.panelSoft, color: UI.ink, fontFamily: UI.sans, lineHeight: 1,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8V2M3 5l3-3 3 3"/><path d="M2 9h8"/>
            </svg>Import
          </button>
          <button onClick={reloadExcel} style={{ border: 'none', background: 'transparent', color: UI.inkFaint, cursor: 'pointer', padding: '5px 6px', fontSize: 13, fontFamily: UI.mono, lineHeight: 1 }}>↺</button>
          <button onClick={resetToSeed} style={{ border: 'none', background: 'transparent', color: UI.inkFaint, cursor: 'pointer', padding: '5px 6px', fontSize: 10, fontFamily: UI.mono, letterSpacing: 0.5, lineHeight: 1, textTransform: 'uppercase' }}>Reset</button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: UI.mono, fontSize: 9.5, color: srcColor, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: srcColor, flex: '0 0 auto' }} />{dataSource}
          </span>
        </>}
      />

      {/* ── Filter strip (Tech + Blockers) ────────────────────────────────── */}
      <FilterStrip
        store={store}
        selectedTechs={selectedTechs} selectedBlockers={selectedBlockers}
        toggleTech={toggleTech} toggleBlocker={toggleBlocker}
        techSynergy={techSynergy} blockerSynergy={blockerSynergy}
        matchMode={matchMode} setMatchMode={setMatchMode}
        blockerMode={blockerMode} setBlockerMode={setBlockerMode}
        filteredInits={filteredInits} matchedSet={matchedSet} blockerMatchedSet={blockerMatchedSet}
        onClearTechs={() => setSelectedTechs(new Set())}
        onClearBlockers={() => setSelectedBlockers(new Set())}
      />

      {/* ── Gantt (full width) ────────────────────────────────────────────── */}
      <div ref={scrollerRef} className="board-scroller" style={{ flex: 1, overflow: 'auto', position: 'relative', minWidth: 0, minHeight: 0 }}>
        <div style={{ display: 'flex', minWidth: labelW + timelineW, position: 'relative' }}>

          {/* ── Label column (sticky left) ─────────────────────────────── */}
          <div style={{
            width: labelW, flex: '0 0 auto', position: 'sticky', left: 0, zIndex: 4,
            background: UI.panel, borderRight: `1px solid ${UI.border}`,
          }}>
            <div style={{
              height: CAL_H, borderBottom: `1px solid ${UI.border}`,
              display: 'flex', alignItems: 'flex-end', padding: '0 14px 10px 20px',
              fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint,
              background: UI.panelSoft,
            }}>Forretningsenhed / Initiativ</div>

            <div style={{ position: 'relative', height: layout.totalH }}>
              {buBands.map((b) => {
                const bu = buById[b.buId]; if (!bu) return null;
                return (
                  <div key={'stripe:' + b.buId + ':' + b.startY} style={{
                    position: 'absolute', left: 0, top: b.startY, width: 4, height: b.endY - b.startY,
                    background: bu.accent, borderRadius: '0 2px 2px 0', opacity: 0.9, zIndex: 1,
                  }} />
                );
              })}

              {layout.rows.map((r) => {
                if (r.kind === 'bu') {
                  const sel = buFilter === r.bu.id;
                  const blockedInBU = store.initiatives.filter((i) => i.buId === r.bu.id && (i.blockerIds || []).length > 0).length;
                  return (
                    <div key={'bu:' + r.bu.id} style={{
                      position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                      padding: '0 12px 0 20px', display: 'flex', alignItems: 'center', gap: 7,
                      borderBottom: `1px solid ${UI.border}`,
                      background: `linear-gradient(90deg, color-mix(in oklch, ${r.bu.accent} 8%, ${UI.panel}) 0%, ${UI.panel} 100%)`,
                    }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: r.bu.accent }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: UI.ink }}>{r.bu.name}</span>
                      <span style={{
                        fontFamily: UI.mono, fontSize: 9.5, color: UI.inkFaint,
                        background: UI.panelSoft, border: `1px solid ${UI.border}`,
                        borderRadius: 4, padding: '1px 5px',
                      }}>{r.count}</span>
                      {blockedInBU > 0 && (
                        <span style={{ fontFamily: UI.mono, fontSize: 9, color: BLOCKER_RED, fontWeight: 700 }}>⚠{blockedInBU}</span>
                      )}
                      <div style={{ flex: 1 }} />
                      <button onClick={() => setBuFilter(sel ? null : r.bu.id)} style={{
                        padding: '2px 7px', fontSize: 9.5, borderRadius: 99, cursor: 'pointer',
                        background: sel ? r.bu.accent : 'transparent',
                        color: sel ? '#fff' : UI.inkFaint,
                        border: `1px solid ${sel ? r.bu.accent : UI.border}`,
                        fontFamily: UI.mono,
                      }}>{sel ? '✓' : r.bu.short}</button>
                      <button onClick={() => newInit(r.bu.id)} title="Nyt initiativ" style={{
                        width: 18, height: 18, borderRadius: 4, border: `1px solid ${UI.border}`,
                        background: '#fff', color: UI.inkMuted, cursor: 'pointer',
                        fontSize: 13, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>+</button>
                    </div>
                  );
                }

                if (r.kind === 'platform') {
                  return (
                    <div key={'plat:' + r.platform.id} style={{
                      position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                      padding: '0 12px 0 28px', display: 'flex', alignItems: 'center', gap: 6,
                      borderBottom: `1px solid color-mix(in oklch, ${r.bu.accent} 18%, transparent)`,
                      background: `color-mix(in oklch, ${r.bu.accent} 7%, ${UI.panel})`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: 2, background: r.bu.accent, opacity: 0.7 }} />
                      <span style={{ fontFamily: UI.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: r.bu.accent }}>{r.platform.name}</span>
                    </div>
                  );
                }

                if (r.kind === 'init') {
                  const { dim } = getBarStyle(r.init, r.bu);
                  const bc = (r.init.blockerIds || []).length;
                  return (
                    <div key={r.init.id} onClick={() => setDrawer({ ...r.init })} style={{
                      position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                      padding: `0 12px 0 ${r.platform ? 40 : 28}px`, display: 'flex', alignItems: 'center', gap: 7,
                      cursor: 'pointer', opacity: dim ? 0.35 : 1, transition: 'opacity .15s',
                      borderBottom: `1px solid color-mix(in oklch, ${UI.border} 60%, transparent)`,
                      borderLeft: r.platform ? `3px solid color-mix(in oklch, ${r.bu.accent} 45%, transparent)` : 'none',
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = UI.panelSoft}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <UiStatusPill status={r.init.status} size="sm" />
                      <div style={{
                        flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: UI.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{r.init.name}</div>
                      {r.platform && (
                        <span style={{
                          fontFamily: UI.mono, fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                          color: r.bu.accent, letterSpacing: 0.3, whiteSpace: 'nowrap',
                          background: `color-mix(in oklch, ${r.bu.accent} 8%, transparent)`,
                          border: `1px solid color-mix(in oklch, ${r.bu.accent} 22%, transparent)`,
                          padding: '1px 5px', borderRadius: 3,
                        }}>{r.platform.name}</span>
                      )}
                      {bc > 0 && (
                        <span style={{ fontFamily: UI.mono, fontSize: 9, color: BLOCKER_RED, fontWeight: 700, flexShrink: 0 }}>⚠{bc}</span>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>

          {/* ── Timeline area ──────────────────────────────────────────── */}
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Calendar header */}
            <div style={{ height: CAL_H, position: 'sticky', top: 0, zIndex: 3, background: UI.panelSoft, borderBottom: `1px solid ${UI.border}` }}>
              <div style={{ display: 'flex', height: 22 }}>
                {(() => {
                  const out = []; let i = 0;
                  while (i < monthList.length) {
                    const m = monthList[i]; const q = quarterOf(m), y = m.getFullYear();
                    let span = 1;
                    while (i + span < monthList.length && quarterOf(monthList[i + span]) === q && monthList[i + span].getFullYear() === y) span++;
                    out.push(
                      <button key={`${y}-Q${q}`} onClick={() => scrollTo(new Date(y, (q - 1) * 3, 1))} style={{
                        width: span * monthW, padding: '0 10px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkMuted,
                        background: 'transparent', border: 'none', borderRight: `1px solid ${UI.border}`,
                        cursor: 'pointer', height: '100%',
                      }}>Q{q} <span style={{ color: UI.inkFaint }}>{y}</span></button>
                    );
                    i += span;
                  }
                  return out;
                })()}
              </div>
              <div style={{ display: 'flex', height: 34, alignItems: 'flex-end', paddingBottom: 6 }}>
                {monthList.map((m, idx) => {
                  const isToday = m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear();
                  return (
                    <div key={idx} style={{
                      width: monthW, padding: '0 10px',
                      borderRight: `1px dashed ${UI.border}`,
                      fontFamily: UI.mono, fontSize: 11,
                      color: isToday ? UI.ink : UI.inkMuted,
                      fontWeight: isToday ? 600 : 400,
                    }}>{fmtMon(m)}</div>
                  );
                })}
              </div>
            </div>

            {/* Timeline body */}
            <div style={{ position: 'relative', height: layout.totalH, width: timelineW }}>
              {monthList.map((_, idx) => (
                <div key={idx} style={{ position: 'absolute', top: 0, left: idx * monthW, bottom: 0, width: 1, background: idx === 0 ? 'transparent' : UI.border, opacity: 0.5 }} />
              ))}

              {(() => {
                const bands = []; let i = 0;
                while (i < monthList.length) {
                  const q = quarterOf(monthList[i]); let span = 1;
                  while (i + span < monthList.length && quarterOf(monthList[i + span]) === q && monthList[i + span].getFullYear() === monthList[i].getFullYear()) span++;
                  if ((q + monthList[i].getFullYear()) % 2 === 0) {
                    bands.push(<div key={'q' + i} style={{ position: 'absolute', top: 0, left: i * monthW, width: span * monthW, bottom: 0, background: 'color-mix(in oklch, oklch(0.6 0.04 80) 3%, transparent)', pointerEvents: 'none' }} />);
                  }
                  i += span;
                }
                return bands;
              })()}

              {buBands.map((b) => {
                const bu = buById[b.buId]; if (!bu) return null;
                return (
                  <div key={'buband:' + b.buId + ':' + b.startY} style={{
                    position: 'absolute', left: 0, top: b.startY, width: timelineW, height: b.endY - b.startY,
                    background: `color-mix(in oklch, ${bu.accent} 3.5%, transparent)`,
                    borderTop: `1px dashed color-mix(in oklch, ${bu.accent} 28%, transparent)`,
                    borderBottom: `1px dashed color-mix(in oklch, ${bu.accent} 28%, transparent)`,
                    pointerEvents: 'none', zIndex: 0,
                  }} />
                );
              })}

              {layout.rows.filter((r) => r.kind === 'bu').map((r) => (
                <div key={'lbg:' + r.bu.id} style={{
                  position: 'absolute', top: r.y, left: 0, width: timelineW, height: r.h,
                  borderBottom: `1px solid ${UI.border}`,
                  background: `color-mix(in oklch, ${r.bu.accent} 5%, transparent)`,
                  pointerEvents: 'none',
                }} />
              ))}

              {layout.rows.filter((r) => r.kind === 'platform').map((r) => (
                <div key={'platbg:' + r.platform.id + ':' + r.y} style={{
                  position: 'absolute', top: r.y, left: 0, width: timelineW, height: r.h,
                  borderBottom: `1px solid color-mix(in oklch, ${r.bu.accent} 18%, transparent)`,
                  background: `color-mix(in oklch, ${r.bu.accent} 6%, transparent)`,
                  pointerEvents: 'none',
                }} />
              ))}

              {/* Platform thread lines — vertical connector from header to last initiative */}
              {platformSpans.map((s) => (
                <div key={'thread:' + s.platform.id} style={{
                  position: 'absolute', top: s.y1 + PLAT_H, left: 3, width: 2,
                  height: s.y2 - s.y1 - PLAT_H,
                  background: `color-mix(in oklch, ${s.bu.accent} 32%, transparent)`,
                  borderRadius: 1, pointerEvents: 'none', zIndex: 1,
                }} />
              ))}

              {/* Synergy / Blocker band */}
              {activeBand && (
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, zIndex: 0, pointerEvents: 'none',
                  left: activeBand.x1, width: Math.max(0, activeBand.x2 - activeBand.x1),
                  background: activeBand.kind === 'blocker'
                    ? `color-mix(in oklch, ${BLOCKER_RED} 7%, transparent)`
                    : `oklch(0.65 0.12 ${activeBand.hue} / 0.07)`,
                  borderLeft: activeBand.kind === 'blocker'
                    ? `2px solid color-mix(in oklch, ${BLOCKER_RED} 45%, transparent)`
                    : `2px solid oklch(0.65 0.15 ${activeBand.hue} / 0.45)`,
                  borderRight: activeBand.kind === 'blocker'
                    ? `2px solid color-mix(in oklch, ${BLOCKER_RED} 45%, transparent)`
                    : `2px solid oklch(0.65 0.15 ${activeBand.hue} / 0.45)`,
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: 6,
                    fontFamily: UI.mono, fontSize: 9,
                    color: activeBand.kind === 'blocker' ? BLOCKER_RED : `oklch(0.4 0.12 ${activeBand.hue})`,
                    letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600,
                    background: activeBand.kind === 'blocker'
                      ? `color-mix(in oklch, ${BLOCKER_RED_BG} 90%, transparent)`
                      : `oklch(0.95 0.04 ${activeBand.hue} / 0.9)`,
                    padding: '1px 5px', borderRadius: 3,
                  }}>{activeBand.buCount} enheder</div>
                </div>
              )}

              {/* Today line */}
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: dateToX(today), background: UI.accent, zIndex: 2, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: -2, left: -20, padding: '2px 6px', background: UI.accent, color: '#fff', borderRadius: 3, fontFamily: UI.mono, fontSize: 9, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>I dag</div>
              </div>

              {/* Synergy connectors */}
              {connectorBars.length > 1 && (
                <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, width: timelineW, height: layout.totalH }}>
                  {(() => {
                    const sorted = [...connectorBars].sort((a, b) => ((a.x1 + a.x2) / 2) - ((b.x1 + b.x2) / 2));
                    const els = [];
                    const isBlockerLine = connectorBars[0]?.isBlocker;
                    const tech = store.technologies.find((t) => t.id === litTechId);
                    const lineColor = isBlockerLine ? BLOCKER_RED : `oklch(0.45 0.15 ${tech ? techHue(tech) : 250})`;
                    for (let k = 0; k < sorted.length - 1; k++) {
                      const a = sorted[k], b = sorted[k + 1];
                      if (a.buId === b.buId) continue;
                      const ax = a.x2 + 4, bx = b.x1 - 4, midX = (ax + bx) / 2;
                      els.push(<path key={k} d={`M ${ax} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${bx} ${b.y}`} fill="none" stroke={lineColor} strokeWidth="1.4" strokeDasharray="4 3" strokeOpacity="0.7" />);
                      els.push(<circle key={k + '-a'} cx={ax} cy={a.y} r="2.5" fill={lineColor} fillOpacity="0.8" />);
                      els.push(<circle key={k + '-b'} cx={bx} cy={b.y} r="2.5" fill={lineColor} fillOpacity="0.8" />);
                    }
                    return els;
                  })()}
                </svg>
              )}

              {/* Initiative bars */}
              {layout.rows.map((r) => {
                if (r.kind !== 'init') return null;
                const i = r.init;
                const s = parseISO(i.start), e = parseISO(i.end);
                const x = dateToX(s), barW = Math.max(24, dateToX(e) - x);
                const { status, hasBlockers, dim, isHot, borderLeftColor, bgOverride, boxShadow } = getBarStyle(i, r.bu);
                const showChips = barW >= 72;
                return (
                  <div key={i.id}
                    onPointerDown={(ev) => { if (ev.target.closest('[data-no-drag]')) return; startBarDrag(ev, i, 'move'); }}
                    onClick={() => onBarClick(i)}
                    title={`${i.name} · ${fmtDay(s)} – ${fmtDay(e)}${hasBlockers ? ` · ⚠ ${(i.blockerIds || []).length} blocker(s)` : ''}`}
                    style={{
                      position: 'absolute', top: r.y + 7, left: x, width: barW, height: r.h - 14,
                      borderRadius: 6, cursor: 'grab',
                      background: bgOverride || `color-mix(in oklch, ${status.color} ${i.status === 'live' ? 18 : 12}%, ${UI.panel})`,
                      border: `1px solid color-mix(in oklch, ${status.color} 35%, transparent)`,
                      borderLeft: `3px solid ${borderLeftColor}`,
                      boxShadow, opacity: dim ? 0.22 : 1,
                      transition: 'opacity .15s, box-shadow .15s',
                      display: 'flex', alignItems: 'center', padding: '0 10px',
                      overflow: 'visible', zIndex: isHot ? 3 : 1,
                      userSelect: 'none', touchAction: 'none',
                    }}>
                    <div data-no-drag onPointerDown={(ev) => startBarDrag(ev, i, 'rL')} style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} />
                    <div data-no-drag onPointerDown={(ev) => startBarDrag(ev, i, 'rR')} style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} />
                    {hasBlockers && <span style={{ fontSize: 9, color: BLOCKER_RED, fontWeight: 700, flex: '0 0 auto', marginRight: 4, lineHeight: 1 }}>⚠</span>}
                    {r.platform && barW >= 90 && (
                      <span style={{
                        fontFamily: UI.mono, fontSize: 8, fontWeight: 700, flex: '0 0 auto', marginRight: 5,
                        color: r.bu.accent, letterSpacing: 0.3, whiteSpace: 'nowrap',
                        background: `color-mix(in oklch, ${r.bu.accent} 10%, ${UI.panel})`,
                        border: `1px solid color-mix(in oklch, ${r.bu.accent} 25%, transparent)`,
                        padding: '1px 4px', borderRadius: 3, lineHeight: 1,
                      }}>{r.platform.name}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11.5, fontWeight: 600, color: UI.ink }}>{i.name}</div>
                    {i.techIds.length > 0 && (
                      <div data-no-drag onPointerDown={(ev) => ev.stopPropagation()} style={{ display: 'flex', gap: 2, marginLeft: 5, flex: '0 0 auto' }}>
                        {showChips ? i.techIds.slice(0, 3).map((tid) => {
                          const tech = techById[tid]; if (!tech) return null;
                          const hot = selectedTechs.has(tid);
                          return (
                            <span key={tid} onClick={(ev) => { ev.stopPropagation(); toggleTech(tid); }} title={tech.name}
                              style={{
                                width: 18, height: 18, borderRadius: 4, flex: '0 0 auto',
                                fontFamily: UI.mono, fontSize: 8.5, fontWeight: 700,
                                color: hot ? '#fff' : UI.inkMuted,
                                background: hot ? UI.ink : UI.panel,
                                border: `1px solid ${hot ? UI.ink : UI.border}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', lineHeight: 1,
                              }}>{tech.name.slice(0, 2).toUpperCase()}</span>
                          );
                        }) : null}
                        {(!showChips || i.techIds.length > 3) && (
                          <span style={{ fontSize: 9, color: UI.inkFaint, fontFamily: UI.mono, alignSelf: 'center', marginLeft: 2 }}>
                            {showChips ? `+${i.techIds.length - 3}` : i.techIds.length}
                          </span>
                        )}
                      </div>
                    )}
                    {(i.milestones || []).map((m, idx) => {
                      const mx = dateToX(parseISO(m.date)) - x;
                      if (mx < 4 || mx > barW - 4) return null;
                      return (
                        <span key={idx} title={`${m.label} · ${m.date}`} style={{
                          position: 'absolute', top: '50%', left: mx, width: 9, height: 9,
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          background: '#fff', border: `1.5px solid ${status.color}`,
                          boxShadow: '0 1px 2px rgba(20,16,12,.15)', pointerEvents: 'none',
                        }} />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Initiative drawer */}
      {drawer && (
        <UiInitiativeDrawer store={store} draft={drawer}
          onClose={() => setDrawer(null)} onSave={saveInit} onDelete={delInit} />
      )}
    </div>
  );
}

window.BoardView = BoardView;

ReactDOM.createRoot(document.getElementById('root')).render(<BoardView />);
