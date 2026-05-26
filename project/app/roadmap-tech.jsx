// Roadmap + Tech Filter view.
// Data source priority on startup:
//   1. localStorage (preserves CRUD edits across reloads)
//   2. data.xlsx fetched from the same origin  (Excel is the source of truth)
//   3. Built-in seed data (offline / file:// fallback)
//
// "Reload Excel" always re-parses data.xlsx and resets localStorage.
// "Import Excel" opens a file picker so any .xlsx can be loaded.

// ─── Date helpers ──────────────────────────────────────────────────────────
const D_MS = 86400000;
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function dateToISO(d) { return d.toISOString().slice(0, 10); }
function fmtMon(d) { return d.toLocaleString('en-US', { month: 'short' }); }
function fmtDay(d) { return d.toLocaleString('en-US', { month: 'short', day: 'numeric' }); }
function quarterOf(d) { return Math.floor(d.getMonth() / 3) + 1; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

function chipBtn(active, small) {
  return {
    padding: small ? '3px 8px' : '5px 10px',
    fontSize: 11,
    fontFamily: small ? UI.mono : UI.sans,
    fontWeight: 500,
    borderRadius: small ? 4 : 99,
    border: `1px solid ${active ? UI.ink : UI.border}`,
    background: active ? UI.ink : 'transparent',
    color: active ? '#fff' : UI.inkMuted,
    cursor: 'pointer',
    lineHeight: 1,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────
const STORE_KEY = 'aiboard:store:v3';

// One-time CSS: make the horizontal roadmap scrollbar visible (design-canvas
// normally hides all scrollbars inside artboards).
if (typeof document !== 'undefined' && !document.getElementById('rmt-styles')) {
  const s = document.createElement('style');
  s.id = 'rmt-styles';
  s.textContent = `
    .ai-board .roadmap-scroller { scrollbar-width: thin !important; }
    .ai-board .roadmap-scroller::-webkit-scrollbar { display: block !important; height: 10px; width: 10px; }
    .ai-board .roadmap-scroller::-webkit-scrollbar-thumb { background: oklch(0.85 0.005 80); border-radius: 5px; }
    .ai-board .roadmap-scroller::-webkit-scrollbar-track { background: transparent; }
    .ai-board .roadmap-scroller::-webkit-scrollbar-thumb:hover { background: oklch(0.7 0.008 80); }
  `;
  document.head.appendChild(s);
}

function readLocalStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && p.platforms && p.initiatives && p.technologies && p.businessUnits) return p;
  } catch (e) {}
  return null;
}

// ─── Loading screen ────────────────────────────────────────────────────────
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

// ─── Main view ─────────────────────────────────────────────────────────────
function RoadmapTechView() {
  // null = still loading; string = ready
  const [store, setStore] = React.useState(null);
  const [dataSource, setDataSource] = React.useState('loading'); // label shown in topbar

  const [statusFilter, setStatusFilter] = React.useState(null);
  const [ownerFilter, setOwnerFilter]   = React.useState(null);
  const [buFilter, setBuFilter]         = React.useState(null);
  const [selectedTechs, setSelectedTechs] = React.useState(() => new Set());
  const [matchMode, setMatchMode] = React.useState('any');
  const [drawer, setDrawer]   = React.useState(null);
  const [zoom, setZoom]       = React.useState(1);
  const [buPopover, setBuPopover] = React.useState(null);
  const dragSuppressRef = React.useRef(null);
  const fileInputRef    = React.useRef(null);

  // Helper: apply a new store and record where the data came from.
  const applyStore = (s, source) => {
    setStore(s);
    setDataSource(source);
    setSelectedTechs(new Set());
    setStatusFilter(null);
    setOwnerFilter(null);
    setBuFilter(null);
    setBuPopover(null);
    setDrawer(null);
  };

  // ── Initial load ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    // 1. If the user has already edited data this session, use it.
    const saved = readLocalStore();
    if (saved) {
      applyStore(saved, 'session');
      return;
    }

    // 2. Try to load data.xlsx from the server.
    fetch('./data.xlsx')
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.arrayBuffer();
      })
      .then((buf) => {
        const parsed = parseExcelBuffer(buf);
        applyStore(parsed, 'data.xlsx');
        try { localStorage.setItem(STORE_KEY, JSON.stringify(parsed)); } catch (e) {}
      })
      .catch(() => {
        // 3. No Excel available — use built-in seed data.
        applyStore(makeStore(), 'built-in seed');
      });
  }, []);

  // Persist CRUD edits to localStorage (debounced).
  React.useEffect(() => {
    if (!store) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
    }, 200);
    return () => clearTimeout(t);
  }, [store]);

  // ── Excel import handlers ────────────────────────────────────────────────
  // "Import Excel" — pick any .xlsx file via the file input.
  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';   // reset so the same file can be re-picked
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseExcelBuffer(ev.target.result);
        applyStore(parsed, file.name);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(parsed)); } catch (err) {}
      } catch (err) {
        alert('Could not read the Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // "Reload Excel" — re-fetch data.xlsx from the server, clearing edits.
  const reloadExcel = () => {
    if (!confirm('Reload data.xlsx? All unsaved edits will be lost.')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    setStore(null);
    setDataSource('loading');
    fetch('./data.xlsx')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const parsed = parseExcelBuffer(buf);
        applyStore(parsed, 'data.xlsx');
        try { localStorage.setItem(STORE_KEY, JSON.stringify(parsed)); } catch (e) {}
      })
      .catch((err) => {
        alert('Could not load data.xlsx: ' + err.message);
        applyStore(makeStore(), 'built-in seed');
      });
  };

  // Show loading screen while we wait for the initial async load.
  if (!store) return <LoadingScreen message="Loading data…" />;

  const today = new Date(2026, 4, 26);
  const techById = _byId(store.technologies);
  const platById = _byId(store.platforms);
  const buById   = _byId(store.businessUnits);

  // ── Filters ───────────────────────────────────────────────────────────────
  const owners = React.useMemo(
    () => [...new Set(store.initiatives.map((i) => i.owner).filter(Boolean))].sort(),
    [store.initiatives]
  );
  const passesBaseFilter = (i) =>
    (!statusFilter || i.status === statusFilter) && (!ownerFilter || i.owner === ownerFilter);
  const filteredInits = store.initiatives.filter(passesBaseFilter);

  const isMatched = (init) => {
    if (selectedTechs.size === 0) return true;
    if (matchMode === 'any') return init.techIds.some((t) => selectedTechs.has(t));
    return [...selectedTechs].every((t) => init.techIds.includes(t));
  };

  const matchedSet = React.useMemo(
    () => new Set(filteredInits.filter(isMatched).map((i) => i.id)),
    [filteredInits, selectedTechs, matchMode]
  );

  const toggleTech = (id) => setSelectedTechs((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ── Time window ───────────────────────────────────────────────────────────
  const range = React.useMemo(() => {
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

  const monthW    = 78 * zoom;
  const labelW    = 270;
  const timelineW = monthList.length * monthW;
  const totalDays = (range.end - range.start) / D_MS + 1;
  const dayPx     = timelineW / totalDays;
  const dateToX   = (d) => ((d - range.start) / D_MS) * dayPx;

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const updateInit = (id, patch) => setStore((s) => ({
    ...s, initiatives: s.initiatives.map((i) => i.id === id ? { ...i, ...patch } : i),
  }));
  const saveInit = (d) => {
    setStore((s) => {
      const exists = s.initiatives.some((i) => i.id === d.id);
      const cleaned = { ...d }; delete cleaned._new;
      if (!cleaned.milestones) cleaned.milestones = [];
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
  const newInit = (platformId) => setDrawer({
    _new: true, id: 'i_' + Math.random().toString(36).slice(2, 7),
    platformId: platformId || (store.platforms[0] && store.platforms[0].id) || 'adobe',
    name: '', status: 'idea', owner: '',
    techIds: [], tags: [], description: '',
    start: dateToISO(today), end: dateToISO(new Date(today.getTime() + 120 * D_MS)),
    milestones: [],
  });

  // ── Layout ────────────────────────────────────────────────────────────────
  const LANE_HEADER = 38, ROW_H = 44, LANE_GAP = 6;
  const visiblePlatforms = store.platforms.filter((p) => !buFilter || p.businessUnitId === buFilter);
  const layout = React.useMemo(() => {
    const rows = []; let y = 0;
    for (const p of visiblePlatforms) {
      const items = store.initiatives.filter((i) => i.platformId === p.id).filter(passesBaseFilter);
      rows.push({ kind: 'lane', platform: p, y, h: LANE_HEADER, count: items.length });
      y += LANE_HEADER;
      for (const i of items) { rows.push({ kind: 'init', init: i, platform: p, y, h: ROW_H }); y += ROW_H; }
      y += LANE_GAP;
    }
    return { rows, totalH: y };
  }, [store, statusFilter, ownerFilter, buFilter]);

  const buBands = React.useMemo(() => {
    const lanes = layout.rows.filter((r) => r.kind === 'lane');
    const bands = []; let i = 0;
    while (i < lanes.length) {
      const bu = lanes[i].platform.businessUnitId; let j = i;
      while (j < lanes.length && lanes[j].platform.businessUnitId === bu) j++;
      const start = lanes[i].y;
      const lastPlat = lanes[j - 1].platform;
      const lastRows = layout.rows.filter((r) => (r.kind === 'init' || r.kind === 'lane') && r.platform.id === lastPlat.id);
      const lastRow  = lastRows[lastRows.length - 1];
      const end = lastRow.y + lastRow.h;
      bands.push({ buId: bu, startY: start, endY: end, platformCount: j - i });
      i = j;
    }
    return bands;
  }, [layout]);

  const litTechId = selectedTechs.size === 1 ? [...selectedTechs][0] : null;
  const litBars = React.useMemo(() => {
    if (!litTechId) return [];
    return layout.rows
      .filter((r) => r.kind === 'init' && r.init.techIds.includes(litTechId))
      .map((r) => ({
        id: r.init.id, x1: dateToX(parseISO(r.init.start)), x2: dateToX(parseISO(r.init.end)),
        y: r.y + r.h / 2, platform: r.platform,
      }));
  }, [litTechId, layout, timelineW]);

  // ── Drag-to-reschedule / resize ───────────────────────────────────────────
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

  const scrollerRef = React.useRef(null);
  const scrollTo = (date) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTo({ left: Math.max(0, dateToX(date) + labelW - 80), behavior: 'smooth' });
  };
  const scrollByMonths = (delta) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: delta * monthW, behavior: 'smooth' });
  };

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e) => { e.stopPropagation(); };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const cats = [...new Set(store.technologies.map((t) => t.category))];

  // ── Data-source badge style ───────────────────────────────────────────────
  const isExcel    = dataSource !== 'built-in seed' && dataSource !== 'session' && dataSource !== 'loading';
  const isSession  = dataSource === 'session';
  const srcBadgeColor = isExcel ? 'oklch(0.52 0.13 150)' : isSession ? UI.inkMuted : UI.inkFaint;

  return (
    <div className="ai-board" data-screen-label="E Roadmap+TechPanel"
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: UI.bg, position: 'relative' }}>

      <UiTopBar
        kicker="ROADMAP · TECHNOLOGY FILTER"
        title="AI Board"
        subtitle="Toggle technologies on the right to highlight only initiatives that use them."
        right={<>
          {/* Status filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, marginRight: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Status</span>
            {[null, ...STATUSES.map((s) => s.id)].map((id) => (
              <button key={id || 'all'} onClick={() => setStatusFilter(id)} style={chipBtn(statusFilter === id)}>
                {id ? STATUSES.find((s) => s.id === id).label : 'All'}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 4px' }} />

          {/* Unit filter */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Unit</span>
            <select value={buFilter || ''} onChange={(e) => setBuFilter(e.target.value || null)} style={{
              padding: '4px 8px', fontSize: 11, fontFamily: UI.sans, border: `1px solid ${UI.border}`,
              borderRadius: 6, background: UI.panel, color: UI.ink, cursor: 'pointer', outline: 'none',
            }}>
              <option value="">All</option>
              {store.businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 4px' }} />

          {/* Owner filter */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Owner</span>
            <select value={ownerFilter || ''} onChange={(e) => setOwnerFilter(e.target.value || null)} style={{
              padding: '4px 8px', fontSize: 11, fontFamily: UI.sans, border: `1px solid ${UI.border}`,
              borderRadius: 6, background: UI.panel, color: UI.ink, cursor: 'pointer', outline: 'none',
            }}>
              <option value="">All</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 4px' }} />

          {/* Timeline navigation + zoom */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint }}>
            <button onClick={() => scrollByMonths(-1)} title="Back 1 month" style={chipBtn(false, true)}>‹</button>
            <button onClick={() => scrollTo(today)} style={chipBtn(false, true)}>Today</button>
            <button onClick={() => scrollByMonths(1)} title="Forward 1 month" style={chipBtn(false, true)}>›</button>
            {[0.75, 1, 1.5].map((z) => (
              <button key={z} onClick={() => setZoom(z)} style={chipBtn(zoom === z, true)}>
                {z === 0.75 ? 'S' : z === 1 ? 'M' : 'L'}
              </button>
            ))}
          </div>

          <UiButton variant="primary" onClick={() => newInit()} icon={<span style={{ fontSize: 14, lineHeight: 0 }}>+</span>}>New</UiButton>

          {/* Excel controls */}
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 2px' }} />

          {/* Hidden file input for importing */}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
            onChange={onFileChange} style={{ display: 'none' }} />

          <button onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Import an Excel file"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              borderRadius: 6, border: `1px solid ${UI.border}`,
              background: UI.panelSoft, color: UI.ink, fontFamily: UI.sans, lineHeight: 1,
            }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8V2M3 5l3-3 3 3"/><path d="M2 9h8"/>
            </svg>
            Import
          </button>

          <button onClick={reloadExcel}
            title="Reload data.xlsx from the server"
            style={{
              border: 'none', background: 'transparent', color: UI.inkFaint,
              cursor: 'pointer', padding: '5px 7px', fontSize: 11, fontFamily: UI.mono,
              letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1,
            }}>
            ↺
          </button>

          {/* Data source indicator */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 0.3,
            color: srcBadgeColor, maxWidth: 120, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: srcBadgeColor, flex: '0 0 auto' }} />
            {dataSource}
          </span>
        </>}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: UI.panel }}>

        {/* ─── ROADMAP (fills remaining space, scrolls within it) ─── */}
        <div ref={scrollerRef} className="roadmap-scroller" style={{ flex: 1, overflow: 'auto', background: UI.panel, position: 'relative', minWidth: 0, minHeight: 0 }}>
          <div style={{ display: 'flex', minWidth: labelW + timelineW, position: 'relative' }}>

            {/* Sticky labels column */}
            <div style={{
              width: labelW, flex: '0 0 auto', position: 'sticky', left: 0, zIndex: 4,
              background: UI.panel, borderRight: `1px solid ${UI.border}`,
            }}>
              <div style={{
                height: 56, borderBottom: `1px solid ${UI.border}`,
                display: 'flex', alignItems: 'flex-end', padding: '0 18px 8px',
                fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint,
                background: UI.panelSoft,
              }}>Platform / initiative</div>

              <div style={{ position: 'relative', height: layout.totalH }}>
                {/* BU left-edge stripes */}
                {buBands.map((b) => {
                  const bu = buById[b.buId]; if (!bu) return null;
                  return (
                    <div key={'bu-stripe:' + b.buId + ':' + b.startY}
                      title={`${bu.name} · Lead: ${bu.lead}`}
                      style={{
                        position: 'absolute', left: 0, top: b.startY, width: 4, height: b.endY - b.startY,
                        background: bu.accent, borderRadius: '0 2px 2px 0', opacity: 0.85, zIndex: 1,
                      }} />
                  );
                })}

                {layout.rows.map((r) => {
                  if (r.kind === 'lane') {
                    const bu = buById[r.platform.businessUnitId];
                    return (
                      <div key={'lane:' + r.platform.id} style={{
                        position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                        padding: '0 18px 0 22px', display: 'flex', alignItems: 'center', gap: 8,
                        borderBottom: `1px solid ${UI.border}`,
                        background: `linear-gradient(90deg, color-mix(in oklch, ${r.platform.accent} 6%, ${UI.panel}) 0%, ${UI.panel} 100%)`,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: r.platform.accent }} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{r.platform.name}</span>
                        <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint }}>{r.count}</span>
                        {bu && (
                          <button onClick={(ev) => {
                            ev.stopPropagation();
                            const rect = ev.currentTarget.getBoundingClientRect();
                            const card = ev.currentTarget.closest('.dc-card') || ev.currentTarget.closest('[data-screen-label]');
                            const aRect = card.getBoundingClientRect();
                            setBuPopover({ buId: bu.id, x: rect.left - aRect.left + rect.width / 2, y: rect.bottom - aRect.top + 6 });
                          }} title={`Owned by ${bu.name} · Lead: ${bu.lead}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '2px 8px 2px 6px', borderRadius: 99, cursor: 'pointer',
                              background: `color-mix(in oklch, ${bu.accent} 10%, transparent)`,
                              border: `1px solid color-mix(in oklch, ${bu.accent} 28%, transparent)`,
                              fontFamily: UI.mono, fontSize: 9.5, color: bu.accent, fontWeight: 500, letterSpacing: 0.3,
                            }}>
                            <span style={{ width: 5, height: 5, borderRadius: 99, background: bu.accent }} />
                            {bu.name}
                          </button>
                        )}
                        <div style={{ flex: 1 }} />
                        <button onClick={() => newInit(r.platform.id)} title="New initiative" style={{
                          width: 20, height: 20, borderRadius: 4, border: `1px solid ${UI.border}`,
                          background: '#fff', color: UI.inkMuted, cursor: 'pointer',
                          fontSize: 13, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>+</button>
                      </div>
                    );
                  }
                  if (r.kind === 'init') {
                    const dim = selectedTechs.size > 0 && !matchedSet.has(r.init.id);
                    return (
                      <div key={r.init.id} onClick={() => setDrawer({ ...r.init })} style={{
                        position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                        padding: '0 18px 0 30px', display: 'flex', alignItems: 'center', gap: 8,
                        cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity .15s',
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.background = UI.panelSoft}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <UiStatusPill status={r.init.status} size="sm" />
                        <div style={{
                          flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: UI.ink,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {r.init.name || <span style={{ fontStyle: 'italic', color: UI.inkFaint }}>Untitled</span>}
                        </div>
                        <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, whiteSpace: 'nowrap' }}>{r.init.owner}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>

            {/* Calendar + bars */}
            <div style={{ flex: 1, position: 'relative' }}>
              {/* Calendar header */}
              <div style={{ height: 56, position: 'sticky', top: 0, zIndex: 3, background: UI.panelSoft, borderBottom: `1px solid ${UI.border}` }}>
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
                        fontFamily: UI.mono, fontSize: 11, color: isToday ? UI.ink : UI.inkMuted,
                        fontWeight: isToday ? 600 : 400,
                      }}>{fmtMon(m)}</div>
                    );
                  })}
                </div>
              </div>

              {/* Body */}
              <div style={{ position: 'relative', height: layout.totalH, width: timelineW }}>
                {monthList.map((m, idx) => (
                  <div key={idx} style={{
                    position: 'absolute', top: 0, left: idx * monthW, bottom: 0, width: 1,
                    background: idx === 0 ? 'transparent' : UI.border, opacity: 0.5,
                  }} />
                ))}

                {/* Quarter shading */}
                {(() => {
                  const bands = []; let i = 0;
                  while (i < monthList.length) {
                    const q = quarterOf(monthList[i]); let span = 1;
                    while (i + span < monthList.length && quarterOf(monthList[i + span]) === q && monthList[i + span].getFullYear() === monthList[i].getFullYear()) span++;
                    if ((q + monthList[i].getFullYear()) % 2 === 0) {
                      bands.push(<div key={'q' + i} style={{
                        position: 'absolute', top: 0, left: i * monthW, width: span * monthW, bottom: 0,
                        background: 'color-mix(in oklch, oklch(0.6 0.04 80) 3%, transparent)',
                      }} />);
                    }
                    i += span;
                  }
                  return bands;
                })()}

                {/* BU banding */}
                {buBands.filter((b) => b.platformCount >= 2).map((b) => {
                  const bu = buById[b.buId]; if (!bu) return null;
                  return (
                    <div key={'bu-band:' + b.buId + ':' + b.startY} style={{
                      position: 'absolute', left: 0, top: b.startY, width: timelineW, height: b.endY - b.startY,
                      background: `color-mix(in oklch, ${bu.accent} 4%, transparent)`,
                      borderTop: `1px dashed color-mix(in oklch, ${bu.accent} 30%, transparent)`,
                      borderBottom: `1px dashed color-mix(in oklch, ${bu.accent} 30%, transparent)`,
                      pointerEvents: 'none', zIndex: 0,
                    }} />
                  );
                })}

                {/* Lane backgrounds */}
                {layout.rows.map((r) => {
                  if (r.kind !== 'lane') return null;
                  return (
                    <div key={'lb:' + r.platform.id} style={{
                      position: 'absolute', top: r.y, left: 0, width: timelineW, height: r.h,
                      borderBottom: `1px solid ${UI.border}`,
                      background: `color-mix(in oklch, ${r.platform.accent} 4%, transparent)`,
                    }} />
                  );
                })}

                {/* Today line */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: dateToX(today), background: UI.accent, zIndex: 2, pointerEvents: 'none' }}>
                  <div style={{
                    position: 'absolute', top: -2, left: -22, padding: '2px 6px',
                    background: UI.accent, color: '#fff', borderRadius: 3,
                    fontFamily: UI.mono, fontSize: 9, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>Today</div>
                </div>

                {/* Cross-tech connectors (exactly 1 tech selected) */}
                {litTechId && litBars.length > 1 && (
                  <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, width: timelineW, height: layout.totalH }}>
                    {(() => {
                      const sorted = [...litBars].sort((a, b) => a.x1 - b.x1);
                      const els = [];
                      for (let k = 0; k < sorted.length - 1; k++) {
                        const a = sorted[k], b = sorted[k + 1];
                        const ax = a.x2 + 4, bx = b.x1 - 4; const midX = (ax + bx) / 2;
                        els.push(<path key={k} d={`M ${ax} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${bx} ${b.y}`}
                          fill="none" stroke={UI.ink} strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.65" />);
                        els.push(<circle key={k + '-a'} cx={ax} cy={a.y} r="2.5" fill={UI.ink} />);
                        els.push(<circle key={k + '-b'} cx={bx} cy={b.y} r="2.5" fill={UI.ink} />);
                      }
                      return els;
                    })()}
                  </svg>
                )}

                {/* Bars */}
                {layout.rows.map((r) => {
                  if (r.kind !== 'init') return null;
                  const i = r.init;
                  const s = parseISO(i.start), e = parseISO(i.end);
                  const x = dateToX(s), w = Math.max(20, dateToX(e) - x);
                  const status  = STATUSES.find((st) => st.id === i.status) || STATUSES[0];
                  const matched = matchedSet.has(i.id);
                  const dim     = selectedTechs.size > 0 && !matched;
                  const isHot   = selectedTechs.size > 0 && matched;
                  return (
                    <div key={i.id}
                      onPointerDown={(ev) => { if (ev.target.closest('[data-no-drag]')) return; startBarDrag(ev, i, 'move'); }}
                      onClick={() => onBarClick(i)}
                      title={`${i.name} · ${fmtDay(s)} – ${fmtDay(e)} · drag to move`}
                      style={{
                        position: 'absolute', top: r.y + 6, left: x, width: w, height: r.h - 12,
                        borderRadius: 6, cursor: 'grab',
                        background: `color-mix(in oklch, ${status.color} ${i.status === 'live' ? 18 : 12}%, ${UI.panel})`,
                        border: `1px solid color-mix(in oklch, ${status.color} 35%, transparent)`,
                        borderLeft: `3px solid ${status.color}`,
                        boxShadow: isHot ? `0 0 0 2px ${r.platform.accent}, 0 6px 16px rgba(20,16,12,.1)` : UI.shadow,
                        opacity: dim ? 0.22 : 1,
                        transition: 'opacity .15s, box-shadow .15s',
                        display: 'flex', alignItems: 'center', padding: '0 14px',
                        overflow: 'visible', zIndex: isHot ? 3 : 1,
                        userSelect: 'none', touchAction: 'none',
                      }}>
                      <div data-no-drag onPointerDown={(ev) => startBarDrag(ev, i, 'rL')}
                        style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} />
                      <div data-no-drag onPointerDown={(ev) => startBarDrag(ev, i, 'rR')}
                        style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} />
                      <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, fontWeight: 600, color: UI.ink }}>{i.name}</div>
                      {i.techIds.length > 0 && (
                        <div data-no-drag onPointerDown={(ev) => ev.stopPropagation()} style={{ display: 'flex', gap: 3, marginLeft: 6, flex: '0 0 auto' }}>
                          {i.techIds.slice(0, 4).map((tid) => {
                            const tech = techById[tid]; if (!tech) return null;
                            const hot = selectedTechs.has(tid);
                            return (
                              <span key={tid} onClick={(ev) => { ev.stopPropagation(); toggleTech(tid); }} title={tech.name}
                                style={{
                                  width: 14, height: 14, borderRadius: 3,
                                  fontFamily: UI.mono, fontSize: 8, fontWeight: 600, color: hot ? '#fff' : UI.inkMuted,
                                  background: hot ? UI.ink : UI.panel, border: `1px solid ${hot ? UI.ink : UI.border}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', flex: '0 0 auto', lineHeight: 1,
                                }}>{tech.name.slice(0, 1).toUpperCase()}</span>
                            );
                          })}
                          {i.techIds.length > 4 && <span style={{ fontSize: 9, color: UI.inkFaint, fontFamily: UI.mono, alignSelf: 'center' }}>+{i.techIds.length - 4}</span>}
                        </div>
                      )}
                      {(i.milestones || []).map((m, idx) => {
                        const mx = dateToX(parseISO(m.date)) - x;
                        if (mx < 4 || mx > w - 4) return null;
                        return (
                          <span key={idx} title={m.label + ' · ' + m.date} style={{
                            position: 'absolute', top: '50%', left: mx, width: 8, height: 8,
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

        {/* ─── TECH FILTER PANEL (bottom horizontal strip) ─── */}
        <div style={{ flex: '0 0 auto', borderTop: `1px solid ${UI.border}`, background: UI.panel, display: 'flex', flexDirection: 'column' }}>
          {/* Header row */}
          <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 30 }}>
            <div style={{ fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint, flex: '0 0 auto' }}>
              Technologies
            </div>
            <div style={{ flex: 1, fontSize: 12.5, color: UI.inkMuted, lineHeight: 1.4 }}>
              {selectedTechs.size === 0 ? (
                <>Tap any tech to highlight only the initiatives using it.</>
              ) : (
                <>Highlighting <b style={{ color: UI.ink }}>{matchedSet.size}</b> of <b style={{ color: UI.ink }}>{filteredInits.length}</b> initiatives matching{' '}
                  <b style={{ color: UI.ink }}>{matchMode === 'any' ? 'any' : 'all'}</b> of <b style={{ color: UI.ink }}>{selectedTechs.size}</b> tech{selectedTechs.size === 1 ? '' : 's'}.</>
              )}
            </div>
            {selectedTechs.size > 0 && (
              <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                {store.platforms.map((p) => {
                  const c = [...matchedSet].map((id) => store.initiatives.find((i) => i.id === id)).filter((i) => i && i.platformId === p.id).length;
                  return (
                    <span key={p.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99,
                      background: c > 0 ? `color-mix(in oklch, ${p.accent} 12%, transparent)` : 'transparent',
                      border: `1px solid ${c > 0 ? `color-mix(in oklch, ${p.accent} 30%, transparent)` : UI.border}`,
                      fontFamily: UI.mono, fontSize: 10.5, color: c > 0 ? UI.ink : UI.inkFaint, opacity: c > 0 ? 1 : 0.6,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: 99, background: p.accent }} />
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ color: UI.inkMuted, opacity: c > 0 ? 0.8 : 1 }}>{c}</span>
                    </span>
                  );
                })}
              </div>
            )}
            {selectedTechs.size > 1 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Match</span>
                {['any', 'all'].map((m) => (
                  <button key={m} onClick={() => setMatchMode(m)} style={chipBtn(matchMode === m, true)}>
                    {m === 'any' ? 'Any' : 'All'}
                  </button>
                ))}
              </div>
            )}
            {selectedTechs.size > 0 && (
              <button onClick={() => setSelectedTechs(new Set())} style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: UI.inkMuted, fontFamily: UI.mono, fontSize: 10, padding: '4px 8px',
                borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5, flex: '0 0 auto',
              }}>× Clear</button>
            )}
          </div>

          {/* Category rows */}
          <div style={{ padding: '4px 16px 10px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: 180 }}>
            {cats.map((cat) => {
              const items = store.technologies.filter((t) => t.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 26 }}>
                  <div style={{ width: 110, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, paddingTop: 6 }}>
                    <UiCategoryDot category={cat} />
                    <span style={{ fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint, fontWeight: 500 }}>{cat}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((t) => {
                      const count    = filteredInits.filter((i) => i.techIds.includes(t.id)).length;
                      const selected = selectedTechs.has(t.id);
                      return (
                        <button key={t.id} onClick={() => toggleTech(t.id)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px 5px 8px', borderRadius: 99,
                          background: selected ? UI.ink : UI.panel, color: selected ? '#fff' : UI.ink,
                          border: `1px solid ${selected ? UI.ink : UI.border}`,
                          fontFamily: UI.mono, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                          transition: 'background .12s, color .12s', lineHeight: 1,
                        }}
                          onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = UI.panelSoft; }}
                          onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = UI.panel; }}>
                          <span style={{
                            width: 12, height: 12, borderRadius: 3, flex: '0 0 auto',
                            border: `1.2px solid ${selected ? '#fff' : UI.borderStrong}`,
                            background: selected ? '#fff' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {selected && (
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke={UI.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1.5 5L4 7.5L8.5 2.5" />
                              </svg>
                            )}
                          </span>
                          <span>{t.name}</span>
                          <span style={{ fontSize: 10, opacity: selected ? 0.6 : 0.5 }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BU Popover */}
      {buPopover && (() => {
        const bu = buById[buPopover.buId]; if (!bu) return null;
        const ownedPlatforms = store.platforms.filter((p) => p.businessUnitId === bu.id);
        const ownedInitCount = store.initiatives.filter((i) => ownedPlatforms.some((p) => p.id === i.platformId)).length;
        const POP_W = 280;
        return (
          <>
            <div onClick={() => setBuPopover(null)} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'transparent' }} />
            <div style={{
              position: 'absolute', zIndex: 41,
              left: Math.max(12, Math.min(buPopover.x - POP_W / 2, 1500 - POP_W - 12)),
              top: buPopover.y, width: POP_W,
              background: UI.panel, borderRadius: 10,
              border: `1px solid ${UI.border}`, boxShadow: UI.shadowMd,
              padding: 16, fontFamily: UI.sans,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 99,
                  background: `color-mix(in oklch, ${bu.accent} 18%, ${UI.panel})`,
                  border: `1.5px solid ${bu.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: UI.mono, fontSize: 11, fontWeight: 600, color: bu.accent,
                }}>{bu.short}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: UI.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint }}>Business unit</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: UI.ink, letterSpacing: -0.2, lineHeight: 1.2 }}>{bu.name}</div>
                </div>
                <button onClick={() => setBuPopover(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.inkMuted, fontSize: 16, lineHeight: 1, padding: 0, width: 22, height: 22 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', rowGap: 8, fontSize: 12 }}>
                <div style={{ color: UI.inkFaint, fontFamily: UI.mono, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>Lead</div>
                <div style={{ color: UI.ink }}>{bu.lead}</div>
                <div style={{ color: UI.inkFaint, fontFamily: UI.mono, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>Owns</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {ownedPlatforms.map((p) => (
                    <span key={p.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 99,
                      background: `color-mix(in oklch, ${p.accent} 10%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${p.accent} 30%, transparent)`,
                      fontSize: 11, color: UI.ink,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: 99, background: p.accent }} />
                      {p.name}
                    </span>
                  ))}
                </div>
                <div style={{ color: UI.inkFaint, fontFamily: UI.mono, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>Total</div>
                <div style={{ color: UI.ink }}>{ownedInitCount} initiative{ownedInitCount === 1 ? '' : 's'}</div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
                <UiButton size="sm" variant={buFilter === bu.id ? 'soft' : 'ghost'}
                  onClick={() => { setBuFilter(buFilter === bu.id ? null : bu.id); setBuPopover(null); }}>
                  {buFilter === bu.id ? '✓ Filtering by this unit' : 'Filter to this unit'}
                </UiButton>
              </div>
            </div>
          </>
        );
      })()}

      {/* Initiative drawer */}
      {drawer && (
        <UiInitiativeDrawer store={store} draft={drawer}
          onClose={() => setDrawer(null)} onSave={saveInit} onDelete={delInit} />
      )}
    </div>
  );
}

window.RoadmapTechView = RoadmapTechView;
