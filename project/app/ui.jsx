// Shared design tokens + UI primitives for AI Board Alt.
// Prefixed Ui* to avoid global collisions.

const UI = {
  bg:           'oklch(0.985 0.004 80)',
  panel:        '#ffffff',
  panelSoft:    'oklch(0.975 0.005 80)',
  border:       'oklch(0.93 0.006 80)',
  borderStrong: 'oklch(0.86 0.008 80)',
  ink:          'oklch(0.22 0.008 80)',
  inkMuted:     'oklch(0.48 0.006 80)',
  inkFaint:     'oklch(0.65 0.006 80)',
  accent:       'oklch(0.55 0.13 250)',
  shadow:       '0 1px 2px rgba(20,16,12,.04), 0 1px 0 rgba(20,16,12,.02)',
  shadowMd:     '0 2px 6px rgba(20,16,12,.05), 0 12px 32px rgba(20,16,12,.06)',
  sans:         "'Geist', 'Söhne', ui-sans-serif, system-ui, sans-serif",
  mono:         "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

function UiTopBar({ title, subtitle, right, kicker }) {
  return (
    <div style={{
      padding: '18px 24px 14px',
      borderBottom: `1px solid ${UI.border}`,
      display: 'flex', alignItems: 'flex-end', gap: 18,
      background: UI.panel, flex: '0 0 auto',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && (
          <div style={{
            fontFamily: UI.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
            color: UI.inkFaint, marginBottom: 5,
          }}>{kicker}</div>
        )}
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: -0.5, color: UI.ink }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: UI.inkMuted, marginTop: 3 }}>{subtitle}</div>
        )}
      </div>
      {right && <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
    </div>
  );
}

function UiButton({ children, onClick, variant = 'ghost', size = 'md', icon, style = {}, title }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: UI.sans, fontWeight: 500, cursor: 'pointer',
    borderRadius: 6, border: '1px solid transparent', transition: 'background .12s, border-color .12s',
    padding: size === 'sm' ? '4px 9px' : '6px 12px',
    fontSize: size === 'sm' ? 12 : 13,
    lineHeight: 1,
  };
  const variants = {
    primary: { background: UI.ink, color: '#fff', borderColor: UI.ink },
    ghost:   { background: 'transparent', color: UI.ink, borderColor: UI.border },
    soft:    { background: UI.panelSoft, color: UI.ink, borderColor: UI.border },
    bare:    { background: 'transparent', color: UI.inkMuted, borderColor: 'transparent' },
  };
  return (
    <button title={title} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => { if (variant === 'bare') e.currentTarget.style.background = UI.panelSoft; }}
      onMouseLeave={(e) => { if (variant === 'bare') e.currentTarget.style.background = 'transparent'; }}>
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
    </button>
  );
}

function UiStatusPill({ status, size = 'md' }) {
  const s = STATUSES.find((x) => x.id === status) || STATUSES[0];
  const isLive = status === 'live';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: UI.sans, fontWeight: 500, fontSize: size === 'sm' ? 10 : 11,
      letterSpacing: 0.2, color: s.color,
      padding: size === 'sm' ? '2px 7px 2px 6px' : '3px 9px 3px 8px',
      borderRadius: 99,
      background: `color-mix(in oklch, ${s.color} 8%, transparent)`,
      border: `1px solid color-mix(in oklch, ${s.color} 24%, transparent)`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: 99,
        background: s.color,
        boxShadow: isLive ? `0 0 0 3px color-mix(in oklch, ${s.color} 20%, transparent)` : 'none',
      }} />
      {s.label}
    </span>
  );
}

function UiToggle({ checked, onChange, label }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      fontFamily: UI.sans, fontSize: 12, color: UI.ink, userSelect: 'none',
    }}>
      <span onClick={() => onChange(!checked)} style={{
        width: 26, height: 15, borderRadius: 99, position: 'relative',
        background: checked ? UI.ink : UI.borderStrong, transition: 'background .15s',
        display: 'inline-block', flex: '0 0 auto',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 13 : 2,
          width: 11, height: 11, borderRadius: 99, background: '#fff',
          transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        }} />
      </span>
      {label}
    </label>
  );
}

function UiCategoryDot({ category }) {
  const hues = {
    'LLM': 250, 'Speech': 30, 'Agent tooling': 200, 'Assistant': 150,
    'Vector DB': 290, 'Framework': 120, 'Image gen': 0, 'Data': 80, 'Observability': 320,
  };
  const h = hues[category] ?? 250;
  return <span title={category} style={{
    width: 7, height: 7, borderRadius: 99, display: 'inline-block',
    background: `oklch(0.62 0.12 ${h})`,
  }} />;
}

function UiBuDot({ bu, size = 8 }) {
  return <span title={bu.name} style={{
    width: size, height: size, borderRadius: 99, display: 'inline-block',
    background: bu.accent, flex: '0 0 auto',
  }} />;
}

const uiInputStyle = {
  width: '100%', boxSizing: 'border-box',
  fontFamily: UI.sans, fontSize: 13, color: UI.ink,
  padding: '7px 9px', border: `1px solid ${UI.border}`, borderRadius: 5,
  background: '#fff', outline: 'none',
};

function UiFieldRow({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: UI.ink, letterSpacing: 0.1 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: UI.inkFaint, fontFamily: UI.mono }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function UiSegmented({ value, options, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', borderRadius: 6, border: `1px solid ${UI.border}`,
      padding: 2, background: UI.panelSoft, gap: 2, width: '100%',
    }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '5px 8px', fontSize: 11, fontWeight: 500,
          fontFamily: UI.sans, color: value === o.value ? UI.ink : UI.inkMuted,
          background: value === o.value ? '#fff' : 'transparent',
          border: 'none', borderRadius: 4, cursor: 'pointer',
          boxShadow: value === o.value ? '0 1px 2px rgba(20,16,12,.06), 0 0 0 1px rgba(20,16,12,.04)' : 'none',
          transition: 'background .12s, color .12s',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

// Initiative create/edit drawer — slides in from right.
function UiInitiativeDrawer({ store, draft, onClose, onSave, onDelete }) {
  const [d, setD] = React.useState(draft);
  React.useEffect(() => setD(draft), [draft?.id, draft?._new]);
  if (!d) return null;
  const bu = store.businessUnits.find((b) => b.id === d.buId) || store.businessUnits[0];
  const techCats = [...new Set(store.technologies.map((t) => t.category))];

  const patch = (k, v) => setD({ ...d, [k]: v });
  const toggleTech = (id) => {
    const next = d.techIds.includes(id) ? d.techIds.filter((x) => x !== id) : [...d.techIds, id];
    setD({ ...d, techIds: next });
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 380,
      background: UI.panel, borderLeft: `1px solid ${UI.border}`,
      boxShadow: '-10px 0 30px rgba(20,16,12,.08)',
      display: 'flex', flexDirection: 'column', zIndex: 30,
      fontFamily: UI.sans,
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${UI.border}` }}>
        <UiBuDot bu={bu} />
        <div style={{ flex: 1, fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint }}>
          {d._new ? 'New initiative' : 'Edit initiative'}
        </div>
        <button onClick={onClose} style={{
          border: 'none', background: 'transparent', color: UI.inkMuted,
          cursor: 'pointer', width: 24, height: 24, borderRadius: 4, fontSize: 18, lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <UiFieldRow label="Name">
          <input value={d.name} onChange={(e) => patch('name', e.target.value)} style={uiInputStyle} />
        </UiFieldRow>

        <UiFieldRow label="Business Unit">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {store.businessUnits.map((b) => {
              const hot = d.buId === b.id;
              return (
                <button key={b.id} onClick={() => setD(prev => ({ ...prev, buId: b.id, platformId: null }))} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: UI.sans, fontSize: 11, fontWeight: hot ? 600 : 400, lineHeight: 1,
                  padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                  background: hot ? b.accent : UI.panelSoft,
                  color: hot ? '#fff' : UI.ink,
                  border: `1.5px solid ${hot ? b.accent : UI.border}`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: hot ? '#fff' : b.accent, opacity: hot ? 0.8 : 1, flex: '0 0 auto' }} />
                  {b.name}
                </button>
              );
            })}
          </div>
        </UiFieldRow>

        {(() => {
          const buPlatforms = (store.platforms || []).filter((p) => p.buId === d.buId);
          if (buPlatforms.length === 0) return null;
          return (
            <UiFieldRow label="Platform">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button onClick={() => patch('platformId', null)} style={{
                  fontFamily: UI.mono, fontSize: 10.5, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                  background: !d.platformId ? UI.ink : UI.panelSoft,
                  color: !d.platformId ? '#fff' : UI.inkMuted,
                  border: `1px solid ${!d.platformId ? UI.ink : UI.border}`,
                }}>None</button>
                {buPlatforms.map((p) => {
                  const hot = d.platformId === p.id;
                  return (
                    <button key={p.id} onClick={() => patch('platformId', p.id)} style={{
                      fontFamily: UI.mono, fontSize: 10.5, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                      background: hot ? UI.ink : UI.panelSoft,
                      color: hot ? '#fff' : UI.ink,
                      border: `1px solid ${hot ? UI.ink : UI.border}`,
                      fontWeight: 500,
                    }}>{p.name}</button>
                  );
                })}
              </div>
            </UiFieldRow>
          );
        })()}

        <UiFieldRow label="Status">
          <UiSegmented value={d.status} options={store.statuses.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => patch('status', v)} />
        </UiFieldRow>

        <UiFieldRow label="Owner">
          <input value={d.owner} onChange={(e) => patch('owner', e.target.value)} style={uiInputStyle} />
        </UiFieldRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <UiFieldRow label="Start">
            <input type="date" value={d.start || ''} onChange={(e) => patch('start', e.target.value)} style={uiInputStyle} />
          </UiFieldRow>
          <UiFieldRow label="End">
            <input type="date" value={d.end || ''} onChange={(e) => patch('end', e.target.value)} style={uiInputStyle} />
          </UiFieldRow>
        </div>

        <UiFieldRow label="Description">
          <textarea value={d.description} onChange={(e) => patch('description', e.target.value)}
            style={{ ...uiInputStyle, height: 65, resize: 'none', lineHeight: 1.45 }} />
        </UiFieldRow>

        <UiFieldRow label="Tags" hint="comma-separated">
          <input value={(d.tags || []).join(', ')}
            onChange={(e) => patch('tags', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
            style={uiInputStyle} />
        </UiFieldRow>

        <UiFieldRow label="Technologies" hint={`${d.techIds.length} selected`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {techCats.map((cat) => (
              <div key={cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <UiCategoryDot category={cat} />
                  <div style={{ fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase', color: UI.inkFaint }}>{cat}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {store.technologies.filter((t) => t.category === cat).map((t) => {
                    const hot = d.techIds.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => toggleTech(t.id)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontFamily: UI.mono, fontSize: 10.5, lineHeight: 1,
                        padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                        background: hot ? UI.ink : UI.panelSoft,
                        color: hot ? '#fff' : UI.ink,
                        border: `1px solid ${hot ? UI.ink : UI.border}`,
                        fontWeight: 500,
                      }}>{t.name}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </UiFieldRow>

        <UiFieldRow label="Blockers" hint={`${(d.blockerIds || []).length} selected`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {[...new Set((store.blockers || []).map((b) => b.category))].map((cat) => (
              <div key={cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, display: 'inline-block', background: 'oklch(0.62 0.18 15)' }} />
                  <div style={{ fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase', color: UI.inkFaint }}>{cat}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(store.blockers || []).filter((b) => b.category === cat).map((b) => {
                    const hot = (d.blockerIds || []).includes(b.id);
                    return (
                      <button key={b.id} onClick={() => {
                        const next = hot
                          ? (d.blockerIds || []).filter((x) => x !== b.id)
                          : [...(d.blockerIds || []), b.id];
                        patch('blockerIds', next);
                      }} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontFamily: UI.mono, fontSize: 10.5, lineHeight: 1,
                        padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                        background: hot ? 'oklch(0.45 0.18 15)' : UI.panelSoft,
                        color: hot ? '#fff' : UI.ink,
                        border: `1px solid ${hot ? 'oklch(0.45 0.18 15)' : UI.border}`,
                        fontWeight: 500,
                      }}>⚠ {b.name}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </UiFieldRow>

        <UiFieldRow label="Milepæle" hint={`${(d.milestones || []).length} defineret`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
            {(d.milestones || []).map((m, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="date" value={m.date || ''} onChange={(e) => {
                  const next = [...d.milestones];
                  next[idx] = { ...m, date: e.target.value };
                  patch('milestones', next);
                }} style={{ ...uiInputStyle, width: 136, flex: '0 0 auto', fontSize: 12 }} />
                <input value={m.label || ''} onChange={(e) => {
                  const next = [...d.milestones];
                  next[idx] = { ...m, label: e.target.value };
                  patch('milestones', next);
                }} placeholder="Label…" style={{ ...uiInputStyle, flex: 1, fontSize: 12 }} />
                <button onClick={() => patch('milestones', d.milestones.filter((_, i) => i !== idx))}
                  style={{ border: 'none', background: 'transparent', color: UI.inkFaint, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', borderRadius: 4, flexShrink: 0 }}
                  title="Fjern milepæl">×</button>
              </div>
            ))}
            <button onClick={() => patch('milestones', [...(d.milestones || []), { date: d.start || '', label: '' }])}
              style={{
                alignSelf: 'flex-start', marginTop: 2,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                borderRadius: 5, border: `1px dashed ${UI.border}`,
                background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans, lineHeight: 1,
              }}>+ Tilføj milepæl</button>
          </div>
        </UiFieldRow>
      </div>

      <div style={{
        padding: '12px 18px', borderTop: `1px solid ${UI.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {!d._new && (
          <UiButton variant="bare" onClick={() => onDelete(d.id)}
            style={{ color: 'oklch(0.55 0.18 25)', marginRight: 'auto' }}>Delete</UiButton>
        )}
        {d._new && <div style={{ marginRight: 'auto' }} />}
        <UiButton variant="ghost" onClick={onClose}>Cancel</UiButton>
        <UiButton variant="primary" onClick={() => onSave(d)}>{d._new ? 'Create' : 'Save'}</UiButton>
      </div>
    </div>
  );
}

// Catalogue CRUD drawer — BUs, Platforms, Technologies, Blockers.
function UiCatalogueDrawer({
  store, onClose,
  onSaveBU, onDelBU,
  onSavePlatform, onDelPlatform,
  onSaveTech, onDelTech,
  onSaveBlocker, onDelBlocker,
}) {
  const TABS = ['BUs', 'Platforms', 'Technologies', 'Blockers'];
  const [tab, setTab] = React.useState('BUs');
  const [editing, setEditing] = React.useState(null); // { kind, id } or null
  const [editDraft, setEditDraft] = React.useState({});
  const [addDraft, setAddDraft] = React.useState({});
  const [addOpen, setAddOpen] = React.useState(false);
  const [err, setErr] = React.useState('');

  const switchTab = (t) => { setTab(t); setEditing(null); setAddDraft({}); setAddOpen(false); setErr(''); };

  const startEdit = (item) => { setEditing({ id: item.id }); setEditDraft({ ...item }); setErr(''); };
  const cancelEdit = () => { setEditing(null); setEditDraft({}); setErr(''); };
  const openAdd = () => { setAddDraft({}); setAddOpen(true); setEditing(null); setErr(''); };
  const cancelAdd = () => { setAddDraft({}); setAddOpen(false); setErr(''); };

  const ep = (k, v) => setEditDraft((d) => ({ ...d, [k]: v }));
  const ap = (k, v) => setAddDraft((d) => ({ ...d, [k]: v }));

  const randId = (prefix) => prefix + Math.random().toString(36).slice(2, 7);

  const inputSm = { ...uiInputStyle, fontSize: 12, padding: '5px 8px' };

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 0', borderBottom: `1px solid color-mix(in oklch, ${UI.border} 60%, transparent)`,
  };
  const actionBtn = (label, onClick, color) => (
    <button onClick={onClick} style={{
      border: 'none', background: 'transparent', cursor: 'pointer',
      color: color || UI.inkFaint, fontSize: 13, lineHeight: 1,
      padding: '2px 4px', borderRadius: 3, fontFamily: UI.sans, flexShrink: 0,
    }}>{label}</button>
  );

  // ── BUs ─────────────────────────────────────────────────────────────────────
  const renderBUs = () => (
    <>
      {store.businessUnits.map((bu) => {
        const isEd = editing?.id === bu.id;
        if (isEd) return (
          <div key={bu.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '10px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6 }}>
              <UiFieldRow label="Name"><input value={editDraft.name || ''} onChange={(e) => ep('name', e.target.value)} style={inputSm} /></UiFieldRow>
              <UiFieldRow label="Short"><input value={editDraft.short || ''} maxLength={3} onChange={(e) => ep('short', e.target.value)} style={inputSm} /></UiFieldRow>
            </div>
            <UiFieldRow label="Accent color" hint="oklch(…)">
              <input value={editDraft.accent || ''} onChange={(e) => ep('accent', e.target.value)} style={inputSm} placeholder="oklch(0.48 0.12 250)" />
            </UiFieldRow>
            <UiFieldRow label="Lead">
              <input value={editDraft.lead || ''} onChange={(e) => ep('lead', e.target.value)} style={inputSm} />
            </UiFieldRow>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', paddingTop: 4 }}>
              {actionBtn('Cancel', cancelEdit)}
              <UiButton size="sm" variant="primary" onClick={() => {
                if (!editDraft.name?.trim()) { setErr('Name is required'); return; }
                onSaveBU(editDraft); cancelEdit();
              }}>Save</UiButton>
            </div>
          </div>
        );
        return (
          <div key={bu.id} style={rowStyle}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: bu.accent, flex: '0 0 auto' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: UI.ink }}>{bu.name}</span>
              <span style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, marginLeft: 6 }}>{bu.short}</span>
            </div>
            <span style={{ fontSize: 11, color: UI.inkMuted, flex: '0 0 auto' }}>{bu.lead}</span>
            {actionBtn('✎', () => startEdit(bu))}
            {actionBtn('×', () => {
              if (store.businessUnits.length <= 1) { setErr('Cannot delete the last business unit'); return; }
              onDelBU(bu.id); setErr('');
            }, 'oklch(0.55 0.18 25)')}
          </div>
        );
      })}
      {err && <div style={{ fontSize: 11, color: 'oklch(0.52 0.2 15)', padding: '4px 0' }}>{err}</div>}
      {addOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: `1px dashed ${UI.border}`, marginTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6 }}>
            <UiFieldRow label="Name"><input value={addDraft.name || ''} onChange={(e) => ap('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
            <UiFieldRow label="Short"><input value={addDraft.short || ''} maxLength={3} onChange={(e) => ap('short', e.target.value)} style={inputSm} /></UiFieldRow>
          </div>
          <UiFieldRow label="Accent color" hint="oklch(…)">
            <input value={addDraft.accent || ''} onChange={(e) => ap('accent', e.target.value)} style={inputSm} placeholder="oklch(0.48 0.12 250)" />
          </UiFieldRow>
          <UiFieldRow label="Lead">
            <input value={addDraft.lead || ''} onChange={(e) => ap('lead', e.target.value)} style={inputSm} />
          </UiFieldRow>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {actionBtn('Cancel', cancelAdd)}
            <UiButton size="sm" variant="primary" onClick={() => {
              if (!addDraft.name?.trim()) { setErr('Name is required'); return; }
              onSaveBU({ id: randId('bu_'), name: addDraft.name.trim(), short: (addDraft.short || addDraft.name.slice(0,2)).toUpperCase(), accent: addDraft.accent || 'oklch(0.48 0.12 250)', lead: addDraft.lead || '' });
              cancelAdd();
            }}>Add BU</UiButton>
          </div>
        </div>
      ) : (
        <button onClick={openAdd} style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 5, border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans }}>+ Add business unit</button>
      )}
    </>
  );

  // ── Platforms ────────────────────────────────────────────────────────────────
  const renderPlatforms = () => (
    <>
      {store.businessUnits.map((bu) => {
        const platList = (store.platforms || []).filter((p) => p.buId === bu.id);
        if (platList.length === 0 && !addOpen) return null;
        return (
          <div key={bu.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: bu.accent }} />
              <span style={{ fontFamily: UI.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: bu.accent }}>{bu.name}</span>
            </div>
            {platList.map((p) => {
              const isEd = editing?.id === p.id;
              if (isEd) return (
                <div key={p.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '8px 0 8px 14px' }}>
                  <UiFieldRow label="Name"><input value={editDraft.name || ''} onChange={(e) => ep('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
                  <UiFieldRow label="Business Unit">
                    <UiSegmented value={editDraft.buId} options={store.businessUnits.map((b) => ({ value: b.id, label: b.name }))} onChange={(v) => ep('buId', v)} />
                  </UiFieldRow>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {actionBtn('Cancel', cancelEdit)}
                    <UiButton size="sm" variant="primary" onClick={() => {
                      if (!editDraft.name?.trim()) { setErr('Name is required'); return; }
                      onSavePlatform(editDraft); cancelEdit();
                    }}>Save</UiButton>
                  </div>
                </div>
              );
              return (
                <div key={p.id} style={{ ...rowStyle, paddingLeft: 14 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: UI.ink }}>{p.name}</div>
                  {actionBtn('✎', () => startEdit(p))}
                  {actionBtn('×', () => { onDelPlatform(p.id); setErr(''); }, 'oklch(0.55 0.18 25)')}
                </div>
              );
            })}
          </div>
        );
      })}
      {err && <div style={{ fontSize: 11, color: 'oklch(0.52 0.2 15)', padding: '4px 0' }}>{err}</div>}
      {addOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: `1px dashed ${UI.border}`, marginTop: 4 }}>
          <UiFieldRow label="Name"><input value={addDraft.name || ''} onChange={(e) => ap('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
          <UiFieldRow label="Business Unit">
            <UiSegmented value={addDraft.buId || store.businessUnits[0]?.id} options={store.businessUnits.map((b) => ({ value: b.id, label: b.name }))} onChange={(v) => ap('buId', v)} />
          </UiFieldRow>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {actionBtn('Cancel', cancelAdd)}
            <UiButton size="sm" variant="primary" onClick={() => {
              if (!addDraft.name?.trim()) { setErr('Name is required'); return; }
              onSavePlatform({ id: randId('p_'), name: addDraft.name.trim(), buId: addDraft.buId || store.businessUnits[0]?.id });
              cancelAdd();
            }}>Add platform</UiButton>
          </div>
        </div>
      ) : (
        <button onClick={openAdd} style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 5, border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans }}>+ Add platform</button>
      )}
    </>
  );

  // ── Tech / Blocker shared list ────────────────────────────────────────────────
  const renderCatList = (items, isBlocker) => {
    const onSave = isBlocker ? onSaveBlocker : onSaveTech;
    const onDel  = isBlocker ? onDelBlocker  : onDelTech;
    const prefix = isBlocker ? 'b_' : 't_';
    const label  = isBlocker ? 'blocker' : 'technology';
    const existingCats = [...new Set(items.map((x) => x.category).filter(Boolean))];
    return (
      <>
        {items.map((item) => {
          const isEd = editing?.id === item.id;
          const hue = item.colorHue ?? (isBlocker ? 15 : 250);
          const dotColor = isBlocker ? `oklch(0.62 0.18 ${hue})` : `oklch(0.62 0.12 ${hue})`;
          if (isEd) return (
            <div key={item.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '8px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <UiFieldRow label="Name"><input value={editDraft.name || ''} onChange={(e) => ep('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
                <UiFieldRow label="Color hue" hint="0–360">
                  <input type="number" min={0} max={360} value={editDraft.colorHue ?? ''} onChange={(e) => ep('colorHue', e.target.value === '' ? null : Number(e.target.value))} style={inputSm} />
                </UiFieldRow>
              </div>
              <UiFieldRow label="Category">
                <input value={editDraft.category || ''} onChange={(e) => ep('category', e.target.value)} style={inputSm} list={`cats-${prefix}`} />
                <datalist id={`cats-${prefix}`}>{existingCats.map((c) => <option key={c} value={c} />)}</datalist>
              </UiFieldRow>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {actionBtn('Cancel', cancelEdit)}
                <UiButton size="sm" variant="primary" onClick={() => {
                  if (!editDraft.name?.trim()) { setErr('Name is required'); return; }
                  onSave(editDraft); cancelEdit();
                }}>Save</UiButton>
              </div>
            </div>
          );
          return (
            <div key={item.id} style={rowStyle}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: dotColor, flex: '0 0 auto' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: UI.ink }}>{item.name}</span>
                {item.category && <span style={{ fontFamily: UI.mono, fontSize: 9.5, color: UI.inkFaint, marginLeft: 6 }}>{item.category}</span>}
              </div>
              {actionBtn('✎', () => startEdit(item))}
              {actionBtn('×', () => { onDel(item.id); setErr(''); }, 'oklch(0.55 0.18 25)')}
            </div>
          );
        })}
        {err && <div style={{ fontSize: 11, color: 'oklch(0.52 0.2 15)', padding: '4px 0' }}>{err}</div>}
        {addOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: `1px dashed ${UI.border}`, marginTop: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <UiFieldRow label="Name"><input value={addDraft.name || ''} onChange={(e) => ap('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
              <UiFieldRow label="Color hue" hint="0–360">
                <input type="number" min={0} max={360} value={addDraft.colorHue ?? ''} onChange={(e) => ap('colorHue', e.target.value === '' ? null : Number(e.target.value))} style={inputSm} />
              </UiFieldRow>
            </div>
            <UiFieldRow label="Category">
              <input value={addDraft.category || ''} onChange={(e) => ap('category', e.target.value)} style={inputSm} list={`cats-${prefix}-add`} />
              <datalist id={`cats-${prefix}-add`}>{existingCats.map((c) => <option key={c} value={c} />)}</datalist>
            </UiFieldRow>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {actionBtn('Cancel', cancelAdd)}
              <UiButton size="sm" variant="primary" onClick={() => {
                if (!addDraft.name?.trim()) { setErr('Name is required'); return; }
                onSave({ id: randId(prefix), name: addDraft.name.trim(), category: addDraft.category || '', colorHue: addDraft.colorHue ?? null });
                cancelAdd();
              }}>Add {label}</UiButton>
            </div>
          </div>
        ) : (
          <button onClick={openAdd} style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 5, border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans }}>+ Add {label}</button>
        )}
      </>
    );
  };

  const content = {
    'BUs':          renderBUs(),
    'Platforms':    renderPlatforms(),
    'Technologies': renderCatList(store.technologies || [], false),
    'Blockers':     renderCatList(store.blockers || [], true),
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 380,
      background: UI.panel, borderLeft: `1px solid ${UI.border}`,
      boxShadow: '-10px 0 30px rgba(20,16,12,.08)',
      display: 'flex', flexDirection: 'column', zIndex: 30,
      fontFamily: UI.sans,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${UI.border}` }}>
        <span style={{ fontSize: 14 }}>⊞</span>
        <div style={{ flex: 1, fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint }}>
          Catalogue
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: UI.inkMuted, cursor: 'pointer', width: 24, height: 24, borderRadius: 4, fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${UI.border}`, background: UI.panelSoft }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => switchTab(t)} style={{
            flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: tab === t ? 600 : 400,
            fontFamily: UI.sans, color: tab === t ? UI.ink : UI.inkMuted,
            background: tab === t ? UI.panel : 'transparent',
            border: 'none', borderBottom: tab === t ? `2px solid ${UI.ink}` : '2px solid transparent',
            cursor: 'pointer', transition: 'color .1s',
          }}>{t}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
        {content[tab]}
      </div>
    </div>
  );
}

// Global fonts + base styles.
if (typeof document !== 'undefined' && !document.getElementById('ui-base-styles')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
  const s = document.createElement('style');
  s.id = 'ui-base-styles';
  s.textContent = `
    .ai-board { font-family: ${UI.sans}; color: ${UI.ink}; }
    .ai-board *, .ai-board *::before, .ai-board *::after { box-sizing: border-box; }
    .ai-board input:focus, .ai-board textarea:focus { border-color: ${UI.ink}; box-shadow: 0 0 0 3px color-mix(in oklch, ${UI.ink} 10%, transparent); }
    .ai-board button:focus-visible { outline: 2px solid ${UI.accent}; outline-offset: 2px; }
    .ai-board ::selection { background: color-mix(in oklch, ${UI.accent} 25%, transparent); }
    .board-scroller { scrollbar-width: thin !important; }
    .board-scroller::-webkit-scrollbar { display: block !important; height: 10px; width: 10px; }
    .board-scroller::-webkit-scrollbar-thumb { background: oklch(0.85 0.005 80); border-radius: 5px; }
    .board-scroller::-webkit-scrollbar-track { background: transparent; }
    .board-scroller::-webkit-scrollbar-thumb:hover { background: oklch(0.7 0.008 80); }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  UI, UiTopBar, UiButton, UiStatusPill, UiToggle,
  UiCategoryDot, UiBuDot, UiInitiativeDrawer, UiCatalogueDrawer, UiFieldRow,
  UiSegmented, uiInputStyle,
});
