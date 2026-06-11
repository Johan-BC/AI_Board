// ── Excel Import View — ét initiativ ad gangen ───────────────────────────────

const AMBER      = '#fef3c7';
const AMBER_BDR  = '#d97706';
const AMBER_TXT  = '#92400e';
const GREEN      = '#f0fdf4';
const GREEN_BDR  = '#16a34a';
const GREEN_TXT  = '#15803d';
const MONTH_DK   = { januar:0,februar:1,marts:2,april:3,maj:4,juni:5,juli:6,august:7,september:8,oktober:9,november:10,december:11 };

// ── Parse helpers ─────────────────────────────────────────────────────────────

function xlStatus(raw) {
  if (!raw) return { v: null, ok: false };
  const s = raw.toString().toLowerCase().trim();
  if (s === 'ide' || s === 'idea') return { v: 'idea', ok: true };
  if (s.startsWith('pilot') || s.includes('tidlig')) return { v: 'pilot', ok: true };
  if (s === 'prod') return { v: 'prod', ok: true };
  if (s.startsWith('test') || s === 'poc') return { v: 'poc', ok: true };
  return { v: null, ok: false, raw: raw.toString() };
}

function xlDate(raw) {
  if (raw == null || raw === '') return { v: null, ok: true };
  if (raw instanceof Date && !isNaN(raw)) return { v: raw.toISOString().slice(0,10), ok: true };
  if (typeof raw === 'number') {
    const d = new Date(Math.round((raw - 25569) * 864e5));
    return { v: d.toISOString().slice(0,10), ok: true };
  }
  const s = raw.toString().trim();
  if (!s || s === 'N/A' || s === '-') return { v: null, ok: true };
  const d = new Date(s);
  if (!isNaN(d.getTime()) && /\d{4}/.test(s)) return { v: d.toISOString().slice(0,10), ok: true };
  return { v: null, ok: false, raw: s };
}

function xlMilestones(raw) {
  if (!raw || raw === 'Ikke angivet') return [];
  const s = raw.toString().trim();
  const d0 = new Date(s);
  if (!isNaN(d0.getTime()) && /\d{4}/.test(s))
    return [{ label: s, date: d0.toISOString().slice(0,10), ok: true }];
  const parts = s.split(/;/).map(p => p.trim()).filter(Boolean);
  return parts.map(p => {
    const m = p.match(/(\d{1,2})\.\s*(januar|februar|marts|april|maj|juni|juli|august|september|oktober|november|december)(?:\s+(\d{4}))?/i);
    if (m) {
      const mo = MONTH_DK[m[2].toLowerCase()];
      const yr = m[3] ? parseInt(m[3]) : 2026;
      return { label: p, date: new Date(yr, mo, parseInt(m[1])).toISOString().slice(0,10), ok: true };
    }
    return { label: p, date: null, ok: false };
  });
}

function fuzzyMatch(rawStr, list) {
  if (!rawStr) return { matched: [], unmatched: [] };
  const terms = rawStr.toString().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const matched = [], unmatched = [];
  for (const term of terms) {
    const tl = term.toLowerCase();
    const found = list.find(item => {
      const n = item.name.toLowerCase();
      return n === tl || n.includes(tl) || tl.includes(n);
    });
    if (found && !matched.includes(found.id)) matched.push(found.id);
    else if (!found) unmatched.push(term);
  }
  return { matched, unmatched };
}

function parseXlRows(rawRows, store) {
  const techs = store.technologies || [];
  const blockers = store.blockers || [];
  const depts = store.departments || [];
  const platforms = store.platforms || [];
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !row[1]) continue;
    const platformRaw = (row[3] || '');
    const techRaw     = (row[4] || '');
    const blockerRaw  = row[9] || '';
    const deptRaw     = (row[2] || '').split(';')[0].trim();
    const statusR   = xlStatus(row[6]);
    const startR    = xlDate(row[11]);
    const endR      = xlDate(row[12]);
    const mstones   = xlMilestones(row[10]);
    const platformM = fuzzyMatch(platformRaw, platforms);
    const techM     = fuzzyMatch(techRaw, techs);
    const blockerM  = fuzzyMatch(blockerRaw, blockers);
    const deptM     = fuzzyMatch(deptRaw, depts);
    rows.push({
      _id: 'imp_' + i,
      include: true,
      name:        (row[1] || '').trim(),
      owner:       (row[7] || '').trim(),
      description: (row[5] || '').trim(),
      status:      statusR,
      buId:        { v: null, ok: false },
      departmentIds: { v: deptM.matched, ok: true, unmatched: deptM.unmatched, raw: deptRaw },
      platformIds:   { v: platformM.matched, ok: true, unmatched: platformM.unmatched },
      techIds:       { v: techM.matched, ok: true, unmatched: techM.unmatched },
      blockerIds:    { v: blockerM.matched, ok: true, unmatched: blockerM.unmatched },
      outcomeIds:    { v: [], ok: true },
      startDate:   startR,
      endDate:     endR,
      milestones:  mstones,
    });
  }
  return rows;
}

function fieldValid(field, required) {
  if (!field) return !required;
  const hasValue   = Array.isArray(field.v) ? field.v.length > 0 : !!field.v;
  const unresolved = (field.unmatched || []).length > 0;
  if (required && !hasValue) return false;
  if (unresolved) return false;
  if (!field.ok) return false;
  return true;
}

function rowNeedsReview(row) {
  return !fieldValid(row.status,        true)  ||
         !fieldValid(row.buId,          true)  ||
         !fieldValid(row.departmentIds, true)  ||
         !fieldValid(row.platformIds,   true)  ||
         !fieldValid(row.techIds,       true)  ||
         !fieldValid(row.outcomeIds,    true);
  // startDate/endDate er valgfrie: null = allerede kørende / BAU
}

// ── Popover ───────────────────────────────────────────────────────────────────

function ImpPopover({ anchorRef, onClose, children, width = 210 }) {
  const ref = React.useRef();
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  React.useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 3, left: Math.min(r.left, window.innerWidth - width - 10) });
    }
    function h(e) {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) onClose();
    }
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return ReactDOM.createPortal(
    <div ref={ref} style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9200,
      background: UI.panel, border: `1px solid ${UI.borderStrong}`,
      borderRadius: 8, boxShadow: UI.shadowMd, width, maxHeight: 300, overflowY: 'auto',
      fontFamily: UI.sans,
    }}>{children}</div>,
    document.body
  );
}

function ImpPopItem({ onClick, children }) {
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12.5,
        background: h ? UI.panelSoft : 'transparent', color: UI.ink }}>
      {children}
    </div>
  );
}

// ── Field primitives ──────────────────────────────────────────────────────────

function Req() {
  return <span style={{ color: AMBER_BDR, marginLeft: 2, fontSize: 10 }}>*</span>;
}

function FieldSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, fontFamily: UI.mono }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, color: UI.inkMuted, marginBottom: 3, fontWeight: 500 }}>{children}</div>;
}

// Single-select dropdown (Status / BU)
function SingleSelect({ value, options, placeholder, getLabel, getColor, onChange, required }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef();
  const current = options.find(o => o.id === value);
  const missing = required && !value;
  const valid   = !!value;
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '5px 10px', borderRadius: 6,
        border: `1px solid ${missing ? AMBER_BDR : valid ? GREEN_BDR : UI.border}`,
        background: missing ? AMBER : valid ? GREEN : UI.panelSoft,
        minWidth: 120, justifyContent: 'space-between', fontSize: 12.5,
      }}>
        {current
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {getColor && <span style={{ width: 10, height: 10, borderRadius: 99, background: getColor(current), flexShrink: 0 }} />}
              {getLabel(current)}
            </span>
          : <span style={{ color: missing ? AMBER_TXT : UI.inkFaint }}>
              {missing ? '⚠ ' : ''}{placeholder}
            </span>}
        <span style={{ color: UI.inkFaint, fontSize: 10 }}>▾</span>
      </div>
      {open && (
        <ImpPopover anchorRef={ref} onClose={() => setOpen(false)}>
          <ImpPopItem onClick={() => { onChange(null); setOpen(false); }}>
            <span style={{ color: UI.inkFaint }}>— ingen —</span>
          </ImpPopItem>
          {options.map(o => (
            <ImpPopItem key={o.id} active={value === o.id} onClick={() => { onChange(o.id); setOpen(false); }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {getColor && <span style={{ width: 9, height: 9, borderRadius: 99, background: getColor(o), flexShrink: 0 }} />}
                {getLabel(o)}
              </span>
            </ImpPopItem>
          ))}
        </ImpPopover>
      )}
    </div>
  );
}

// Resolver for a single unmatched raw value
function UnmatchedItem({ raw, list, type, onResolve, onAddExtra, onDismiss }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef();
  const filtered = search ? list.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : list;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
      <span style={{
        background: AMBER, border: `1px solid ${AMBER_BDR}`, borderRadius: 5, padding: '3px 8px',
        fontSize: 11.5, color: AMBER_TXT, fontWeight: 500,
      }}>⚠ {raw}</span>
      <span style={{ fontSize: 11, color: UI.inkFaint }}>→</span>
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          fontSize: 11.5, padding: '3px 9px', border: `1px solid ${UI.border}`,
          borderRadius: 5, background: UI.panelSoft, cursor: 'pointer', fontFamily: UI.sans, color: UI.ink,
        }}>Vælg match ▾</button>
        {open && (
          <ImpPopover anchorRef={ref} onClose={() => { setOpen(false); setSearch(''); }} width={230}>
            <div style={{ padding: '5px 8px', borderBottom: `1px solid ${UI.border}` }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg…" autoFocus
                style={{ width: '100%', fontSize: 11.5, border: `1px solid ${UI.border}`, borderRadius: 4, padding: '3px 6px', fontFamily: UI.sans }} />
            </div>
            {filtered.map(item => (
              <ImpPopItem key={item.id} onClick={() => { onResolve(item.id); setOpen(false); setSearch(''); }}>
                {item.id.includes('_xl_') && <span style={{ fontSize: 9, color: '#7c3aed', marginRight: 4, fontWeight: 700 }}>NY</span>}
                {item.name}
              </ImpPopItem>
            ))}
            <div style={{ borderTop: `1px solid ${UI.border}` }}>
              <ImpPopItem onClick={() => { const id = onAddExtra(type, raw); onResolve(id); setOpen(false); }}>
                <span style={{ color: '#7c3aed', fontWeight: 500 }}>+ Tilføj "{raw}" som ny</span>
              </ImpPopItem>
              <ImpPopItem onClick={() => { onDismiss(); setOpen(false); }}>
                <span style={{ color: UI.inkFaint }}>✕ Ignorer denne</span>
              </ImpPopItem>
            </div>
          </ImpPopover>
        )}
      </div>
    </div>
  );
}

// Multi-select with unmatched resolvers
function MultiField({ field, list, type, label, onChange, onAddExtra, required }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef();
  const selected = list.filter(i => field.v.includes(i.id));
  const unmatched = field.unmatched || [];
  const isEmpty = required && selected.length === 0 && unmatched.length === 0;
  const needsMark = isEmpty || unmatched.length > 0;
  const filtered = search ? list.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : list;

  function toggle(id) {
    const next = field.v.includes(id) ? field.v.filter(x => x !== id) : [...field.v, id];
    onChange({ ...field, v: next });
  }
  function resolveUnmatched(raw, id) {
    const nextV = field.v.includes(id) ? field.v : [...field.v, id];
    onChange({ ...field, v: nextV, unmatched: unmatched.filter(u => u !== raw) });
  }
  function dismissUnmatched(raw) {
    onChange({ ...field, unmatched: unmatched.filter(u => u !== raw) });
  }
  const hasValue  = field.v.length > 0;
  const isGreen   = hasValue && unmatched.length === 0;
  return (
    <div style={
      needsMark ? { border: `1.5px solid ${AMBER_BDR}`, borderRadius: 8, padding: '8px 10px', background: AMBER } :
      isGreen   ? { border: `1.5px solid ${GREEN_BDR}`,  borderRadius: 8, padding: '8px 10px', background: GREEN } :
      {}
    }>
      {isEmpty && (
        <div style={{ fontSize: 11, color: AMBER_TXT, fontWeight: 600, marginBottom: 6 }}>⚠ Påkrævet — vælg mindst én {label}</div>
      )}
      {/* Matched chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {selected.map(item => {
          const isNew = item.id.includes('_xl_');
          return (
            <span key={item.id} style={{
              background: isNew ? '#f5f3ff' : GREEN,
              border: `1px solid ${isNew ? '#c4b5fd' : GREEN_BDR}`,
              borderRadius: 6, padding: '3px 9px', fontSize: 12,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              color: isNew ? '#5b21b6' : GREEN_TXT,
            }}>
              {isNew && <span style={{ fontSize: 8, fontWeight: 700 }}>NY</span>}
              {item.name}
              <span onClick={() => toggle(item.id)} style={{ cursor: 'pointer', opacity: 0.5, lineHeight: 1, marginLeft: 2 }}>×</span>
            </span>
          );
        })}
        <div ref={ref} style={{ display: 'inline-block' }}>
          <span onClick={() => setOpen(o => !o)} style={{
            cursor: 'pointer', border: `1.5px dashed ${UI.border}`, borderRadius: 6,
            padding: '3px 9px', fontSize: 12, color: UI.inkFaint, display: 'inline-block',
          }}>+ {label}</span>
          {open && (
            <ImpPopover anchorRef={ref} onClose={() => { setOpen(false); setSearch(''); }}>
              <div style={{ padding: '5px 8px', borderBottom: `1px solid ${UI.border}` }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg…" autoFocus
                  style={{ width: '100%', fontSize: 11.5, border: `1px solid ${UI.border}`, borderRadius: 4, padding: '3px 6px', fontFamily: UI.sans }} />
              </div>
              {filtered.map(item => (
                <ImpPopItem key={item.id} onClick={() => toggle(item.id)}>
                  <span style={{ width: 14, display: 'inline-block', color: UI.accent }}>{field.v.includes(item.id) ? '✓' : ''}</span>
                  {item.id.includes('_xl_') && <span style={{ fontSize: 9, color: '#7c3aed', marginRight: 4, fontWeight: 700 }}>NY</span>}
                  {item.name}
                </ImpPopItem>
              ))}
              <div style={{ borderTop: `1px solid ${UI.border}`, padding: '5px 8px', display: 'flex', gap: 4 }}>
                <input placeholder={`Ny ${label}…`} onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const id = onAddExtra(type, e.target.value.trim());
                    onChange({ ...field, v: [...field.v, id] });
                    e.target.value = '';
                    setOpen(false);
                  }
                }} style={{ flex: 1, fontSize: 11.5, border: `1px solid ${UI.border}`, borderRadius: 4, padding: '3px 6px', fontFamily: UI.sans }} />
              </div>
            </ImpPopover>
          )}
        </div>
      </div>
      {/* Unmatched resolvers */}
      {unmatched.map(raw => (
        <UnmatchedItem key={raw} raw={raw} list={list} type={type}
          onResolve={id => resolveUnmatched(raw, id)}
          onAddExtra={onAddExtra}
          onDismiss={() => dismissUnmatched(raw)} />
      ))}
    </div>
  );
}

// Date field
function DateField({ field, onChange, required }) {
  const isEmpty = required && !field.v;
  const hasRawError = !field.ok && field.raw;
  const showAmber = isEmpty || hasRawError;
  const showGreen = !showAmber && field.v;
  return (
    <div style={
      showAmber ? { border: `1.5px solid ${AMBER_BDR}`, borderRadius: 8, padding: '8px 10px', background: AMBER } :
      showGreen ? { border: `1.5px solid ${GREEN_BDR}`,  borderRadius: 8, padding: '8px 10px', background: GREEN } :
      {}
    }>
      {isEmpty && !hasRawError && (
        <div style={{ fontSize: 11, color: AMBER_TXT, fontWeight: 600, marginBottom: 5 }}>⚠ Påkrævet</div>
      )}
      {hasRawError && (
        <div style={{ fontSize: 11.5, color: AMBER_TXT, fontWeight: 500, marginBottom: 5 }}>
          ⚠ Originalværdi: "{field.raw}"
        </div>
      )}
      <input type="date" value={field.v || ''}
        onChange={e => onChange({ v: e.target.value || null, ok: true })}
        style={{
          fontSize: 12.5, fontFamily: UI.sans,
          border: `1px solid ${showAmber ? AMBER_BDR : UI.border}`,
          borderRadius: 6, padding: '5px 8px', background: UI.panel, color: UI.ink, display: 'block',
        }} />
    </div>
  );
}

// Milestone field
function MilestoneField({ milestones, onChange }) {
  if (!milestones.length) return <span style={{ color: UI.inkFaint, fontSize: 12 }}>Ingen milestones i Excel</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {milestones.map((m, i) => (
        <div key={i} style={{ background: m.ok ? UI.panelSoft : AMBER, border: `1px solid ${m.ok ? UI.border : AMBER_BDR}`, borderRadius: 7, padding: '8px 12px' }}>
          <div style={{ fontSize: 12.5, color: UI.ink, marginBottom: 6, lineHeight: 1.4 }}>
            {!m.ok && <span style={{ color: AMBER_BDR, marginRight: 5 }}>⚠</span>}
            {m.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: UI.inkMuted }}>Dato:</span>
            <input type="date" value={m.date || ''}
              onChange={e => {
                const next = milestones.map((x, j) => j === i ? { ...x, date: e.target.value || null, ok: !!e.target.value } : x);
                onChange(next);
              }}
              style={{ fontSize: 12, fontFamily: UI.sans, border: `1px solid ${m.ok ? UI.border : AMBER_BDR}`, borderRadius: 5, padding: '3px 7px', background: UI.panel }} />
            {!m.ok && !m.date && <span style={{ fontSize: 11, color: AMBER_TXT }}>Angiv specifik dato</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function ImpSidebar({ rows, currentIdx, onSelect }) {
  return (
    <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${UI.border}`, overflowY: 'auto', background: UI.panelSoft }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${UI.border}`, fontSize: 11, fontWeight: 600, color: UI.inkMuted, fontFamily: UI.mono, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {rows.length} initiativer
      </div>
      {rows.map((row, idx) => {
        const active   = idx === currentIdx;
        const excluded = !row.include;
        const review   = row.include && rowNeedsReview(row);
        const ready    = row.include && !rowNeedsReview(row);
        return (
          <div key={row._id} onClick={() => onSelect(idx)} style={{
            padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 7,
            background: active ? UI.panel : 'transparent',
            borderLeft: `3px solid ${active ? UI.accent : 'transparent'}`,
            borderBottom: `1px solid ${UI.border}`,
          }}>
            <span style={{ fontSize: 10, color: UI.inkFaint, fontFamily: UI.mono, marginTop: 2, minWidth: 18, flexShrink: 0 }}>{idx + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: excluded ? UI.inkFaint : UI.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.name || '—'}
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>
                {excluded && <span style={{ color: UI.inkFaint }}>— Udeladt</span>}
                {review   && <span style={{ color: AMBER_BDR }}>⚠ Gennemgang</span>}
                {ready    && <span style={{ color: GREEN_TXT }}>✓ Klar</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ImpCard({ row, statuses, allBUs, allDepts, allPlatforms, allTechs, allBlockers, allOutcomes, onUpdate, onAddExtra }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 28, fontFamily: UI.sans }}>

      {/* Include toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, color: UI.inkMuted }}>
          <input type="checkbox" checked={row.include}
            onChange={e => onUpdate(r => ({ ...r, include: e.target.checked }))} />
          Medtag i import
        </label>
      </div>

      {/* Name + Owner */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: UI.ink, letterSpacing: -0.5, marginBottom: 4 }}>{row.name}</div>
        {row.owner && <div style={{ fontSize: 13, color: UI.inkMuted }}>Ejer: <b>{row.owner}</b></div>}
      </div>

      {/* Beskrivelse */}
      {row.description && (
        <FieldSection title="Beskrivelse">
          <div style={{ fontSize: 13, color: UI.ink, lineHeight: 1.6, background: UI.panelSoft, border: `1px solid ${UI.border}`, borderRadius: 7, padding: '10px 14px', whiteSpace: 'pre-wrap' }}>
            {row.description}
          </div>
        </FieldSection>
      )}

      {/* Klassificering */}
      <FieldSection title="Klassificering">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <FieldLabel>Status <Req /></FieldLabel>
            <SingleSelect value={row.status.v} options={statuses} placeholder={row.status.raw ? `⚠ "${row.status.raw}"` : 'Vælg status'} required
              getLabel={s => s.label}
              getColor={s => s.color}
              onChange={v => onUpdate(r => ({ ...r, status: { v, ok: true } }))} />
          </div>
          <div>
            <FieldLabel>Business Unit <Req /></FieldLabel>
            <SingleSelect value={row.buId.v} options={allBUs} placeholder="Vælg BU" required
              getLabel={b => b.name}
              getColor={b => b.accent}
              onChange={v => onUpdate(r => ({ ...r, buId: { v, ok: !!v } }))} />
          </div>
          <div>
            <FieldLabel>Afdeling <Req /></FieldLabel>
            <MultiField field={row.departmentIds} list={allDepts} type="departments" label="afdeling" required
              onChange={f => onUpdate(r => ({ ...r, departmentIds: f }))}
              onAddExtra={onAddExtra} />
          </div>
        </div>
      </FieldSection>

      {/* Platform */}
      <FieldSection title="Platform *">
        <MultiField field={row.platformIds} list={allPlatforms} type="platforms" label="platform" required
          onChange={f => onUpdate(r => ({ ...r, platformIds: f }))}
          onAddExtra={onAddExtra} />
      </FieldSection>

      {/* Teknologier */}
      <FieldSection title="Teknologier *">
        <MultiField field={row.techIds} list={allTechs} type="techs" label="teknologi" required
          onChange={f => onUpdate(r => ({ ...r, techIds: f }))}
          onAddExtra={onAddExtra} />
      </FieldSection>

      {/* Blockere */}
      <FieldSection title="Blockere">
        <MultiField field={row.blockerIds} list={allBlockers} type="blockers" label="blocker"
          onChange={f => onUpdate(r => ({ ...r, blockerIds: f }))}
          onAddExtra={onAddExtra} />
      </FieldSection>

      {/* Outcomes */}
      <FieldSection title="Outcomes *">
        <MultiField field={row.outcomeIds} list={allOutcomes} type="outcomes" label="outcome" required
          onChange={f => onUpdate(r => ({ ...r, outcomeIds: f }))}
          onAddExtra={onAddExtra} />
      </FieldSection>

      {/* Tidsplan */}
      <FieldSection title="Tidsplan">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <FieldLabel>Startdato <span style={{fontSize:10,color:'#6b7280'}}>(tom = allerede kørende)</span></FieldLabel>
            <DateField field={row.startDate} onChange={f => onUpdate(r => ({ ...r, startDate: f }))} />
          </div>
          <div>
            <FieldLabel>Slutdato <span style={{fontSize:10,color:'#6b7280'}}>(tom = BAU / løbende)</span></FieldLabel>
            <DateField field={row.endDate} onChange={f => onUpdate(r => ({ ...r, endDate: f }))} />
          </div>
        </div>
      </FieldSection>

      {/* Milestones */}
      <FieldSection title="Milestones">
        <MilestoneField milestones={row.milestones}
          onChange={ms => onUpdate(r => ({ ...r, milestones: ms }))} />
      </FieldSection>

    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function ImpDropZone({ onFile }) {
  const [drag, setDrag] = React.useState(false);
  const fileRef = React.useRef();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: UI.bg }}>
      <div onDragEnter={e => { e.preventDefault(); setDrag(true); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        style={{
          width: 420, padding: '52px 48px', textAlign: 'center', cursor: 'pointer',
          border: `2px dashed ${drag ? UI.accent : UI.borderStrong}`, borderRadius: 14,
          background: drag ? 'oklch(0.97 0.015 250)' : UI.panel,
          transition: 'all .15s', boxShadow: UI.shadow,
        }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: UI.ink, marginBottom: 6 }}>Træk Excel-fil hertil</div>
        <div style={{ fontSize: 13, color: UI.inkMuted, marginBottom: 16 }}>eller klik for at vælge fil</div>
        <div style={{ fontSize: 11, color: UI.inkFaint, fontFamily: UI.mono }}>.xlsx · .xls</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => onFile(e.target.files[0])} />
      </div>
    </div>
  );
}

// ── Main Import View ──────────────────────────────────────────────────────────

function UiImportView({ store, onImport, onGoToBoard }) {
  const [rows, setRows]     = React.useState(null);
  const [cur, setCur]       = React.useState(0);
  const [extra, setExtra]   = React.useState({ techs: [], blockers: [], departments: [], outcomes: [], platforms: [] });

  const allTechs      = [...(store.technologies || []), ...extra.techs];
  const allBlockers   = [...(store.blockers || []),     ...extra.blockers];
  const allDepts      = [...(store.departments || []),  ...extra.departments];
  const allPlatforms  = [...(store.platforms || []),    ...extra.platforms];
  const allBUs        = store.businessUnits || [];
  const allOutcomes   = [...(store.outcomes || []),     ...extra.outcomes];
  const statuses      = store.statuses || [];

  function handleFile(file) {
    if (!file || !file.name.match(/\.xlsx?$/i)) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        setRows(parseXlRows(raw, store));
        setExtra({ techs: [], blockers: [], departments: [], outcomes: [], platforms: [] });
        setCur(0);
      } catch (err) { alert('Kunne ikke læse filen: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }

  function addExtra(type, name) {
    const id   = type.slice(0, -1) + '_xl_' + Date.now();
    const item = type === 'techs'     ? { id, name, category: 'Import', colorHue: 200 }
               : type === 'blockers'  ? { id, name, category: 'Import', colorHue: 30 }
               : type === 'outcomes'  ? { id, name, category: 'Import', colorHue: 120 }
               : type === 'platforms' ? { id, name }
               : { id, name, buId: null };
    setExtra(e => ({ ...e, [type]: [...e[type], item] }));
    return id;
  }

  function updateRow(id, updater) {
    setRows(rs => rs.map(r => r._id === id ? updater(r) : r));
  }

  function doImportOne(rowId) {
    const row = (rows || []).find(r => r._id === rowId);
    if (!row) return;
    onImport([row], extra);
    const nextRows = (rows || []).filter(r => r._id !== rowId);
    setRows(nextRows);
    setCur(c => Math.min(c, Math.max(0, nextRows.length - 1)));
  }

  if (!rows) return <ImpDropZone onFile={handleFile} />;

  // All imported — show completion state
  if (rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: UI.sans }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: UI.ink }}>Alle initiativer importeret</div>
        <div style={{ fontSize: 13, color: UI.inkMuted, marginBottom: 8 }}>Du kan nu gå til boardet for at se dem.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setRows(null)} style={{ fontSize: 13, padding: '8px 18px', border: `1px solid ${UI.border}`, borderRadius: 7, cursor: 'pointer', background: UI.panelSoft, color: UI.ink, fontFamily: UI.sans }}>← Nyt import</button>
          <button onClick={onGoToBoard} style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', border: 'none', borderRadius: 7, cursor: 'pointer', background: UI.accent, color: '#fff', fontFamily: UI.sans }}>Gå til Gantt →</button>
        </div>
      </div>
    );
  }

  const row      = rows[cur];
  const included = rows.filter(r => r.include);
  const reviews  = included.filter(rowNeedsReview).length;

  const btnStyle = (primary) => ({
    fontSize: 12.5, fontWeight: primary ? 600 : 400, padding: '6px 14px',
    border: `1px solid ${primary ? 'transparent' : UI.border}`, borderRadius: 6,
    cursor: 'pointer', fontFamily: UI.sans,
    background: primary ? UI.accent : UI.panelSoft,
    color: primary ? '#fff' : UI.ink,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: UI.sans }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${UI.border}`, flexShrink: 0, background: UI.panel }}>
        <button onClick={() => setRows(null)} style={btnStyle(false)}>← Nyt import</button>
        <div style={{ width: 1, height: 18, background: UI.border }} />

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCur(c => Math.max(0, c - 1))} disabled={cur === 0} style={{ ...btnStyle(false), padding: '4px 10px' }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: UI.ink }}>{cur + 1}</span>
            <span style={{ fontSize: 12, color: UI.inkFaint }}> / {rows.length}</span>
          </div>
          <button onClick={() => setCur(c => Math.min(rows.length - 1, c + 1))} disabled={cur === rows.length - 1} style={{ ...btnStyle(false), padding: '4px 10px' }}>›</button>
        </div>

        {/* Progress bar */}
        <div style={{ width: 120, height: 5, background: UI.border, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((cur + 1) / rows.length) * 100}%`, background: UI.accent, borderRadius: 99, transition: 'width .2s' }} />
        </div>

        <div style={{ fontSize: 12, color: UI.inkMuted }}>
          {included.length} valgt
          {reviews > 0 && <span style={{ color: AMBER_BDR, marginLeft: 6 }}>· ⚠ {reviews} til gennemgang</span>}
        </div>

        <div style={{ flex: 1 }} />

        {/* Per-initiative import button — green, only enabled when current row is ready */}
        {(() => {
          const canImport = row && row.include && !rowNeedsReview(row);
          return (
            <button
              onClick={() => canImport && doImportOne(row._id)}
              disabled={!canImport}
              title={canImport ? 'Importer dette initiativ til boardet' : 'Udfyld alle obligatoriske felter først'}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: '6px 16px',
                border: 'none', borderRadius: 6, fontFamily: UI.sans,
                cursor: canImport ? 'pointer' : 'not-allowed',
                background: canImport ? 'oklch(0.52 0.14 145)' : UI.border,
                color: canImport ? '#fff' : UI.inkFaint,
                transition: 'background .15s, color .15s',
              }}>
              ↑ Importer til board
            </button>
          );
        })()}

        <button onClick={onGoToBoard} style={btnStyle(false)}>Gå til Gantt →</button>
      </div>

      {/* ── Body: sidebar + card ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ImpSidebar rows={rows} currentIdx={cur} onSelect={setCur} />

        {row ? (
          <ImpCard row={row}
            statuses={statuses} allBUs={allBUs} allDepts={allDepts}
            allPlatforms={allPlatforms} allTechs={allTechs} allBlockers={allBlockers} allOutcomes={allOutcomes}
            onUpdate={updater => updateRow(row._id, updater)}
            onAddExtra={addExtra} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: UI.inkFaint }}>
            Vælg et initiativ i listen til venstre
          </div>
        )}
      </div>
    </div>
  );
}
