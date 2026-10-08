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
      display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap',
      background: UI.panel, flex: '0 0 auto',
    }}>
      {/* Title keeps at least 280px; when the controls don't fit beside it
          they wrap onto their own line instead of squeezing the title. */}
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
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
      {right && <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 6 }}>{right}</div>}
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

// Resolve a status id → { id, label, color }. Prefers the live `statuses`
// (from data.json/store) over the compiled-in STATUSES constant, so newer
// statuses (e.g. 'prod') resolve even if a stale cached build is running.
// Unknown ids render AS THEMSELVES (neutral pill) instead of silently
// masquerading as STATUSES[0] ('Idea').
function resolveStatus(status, statuses) {
  const list = (statuses && statuses.length) ? statuses : STATUSES;
  const found = list.find((x) => x.id === status);
  if (found) return found;
  const label = status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : 'Ukendt';
  return { id: status || 'unknown', label, color: 'oklch(0.55 0.02 80)' };
}

function UiStatusPill({ status, statuses, size = 'md' }) {
  const s = resolveStatus(status, statuses);
  const isLive = status === 'prod';
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

// Assessment comments: a list per criterion. A legacy single `note` reads as one comment.
function commentsOf(block) {
  if (!block) return [];
  if (Array.isArray(block.comments)) return block.comments;
  return block.note ? [{ id: 'legacy', text: block.note, at: null }] : [];
}

function UiComments({ comments, onChange, compact = false }) {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const close = () => { setAdding(false); setDraft(''); };
  const submit = () => {
    const text = draft.trim();
    if (text) onChange([...comments, { id: `c_${Date.now()}`, text, at: dateToISO(new Date()) }]);
    close();
  };
  const fs = compact ? 11 : 12;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {comments.map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: fs, lineHeight: 1.45 }}>
          <div style={{ flex: 1, minWidth: 0, color: UI.ink, whiteSpace: 'pre-wrap' }}>
            {c.text}
            {c.at && <span style={{ marginLeft: 6, fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint }}>{c.at}</span>}
          </div>
          <button onClick={() => onChange(comments.filter((x) => x.id !== c.id))} aria-label="Slet kommentar" style={{
            border: 'none', background: 'transparent', color: UI.inkFaint, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0,
          }}>×</button>
        </div>
      ))}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <textarea autoFocus value={draft} rows={2} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            style={{ ...uiInputStyle, resize: 'vertical', lineHeight: 1.45, fontSize: fs }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={submit} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
              background: UI.ink, color: '#fff', border: `1px solid ${UI.ink}`, fontFamily: UI.sans,
            }}>Gem</button>
            <button onClick={close} style={{
              padding: '3px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
              background: 'transparent', color: UI.inkMuted, border: `1px solid ${UI.border}`, fontFamily: UI.sans,
            }}>Annuller</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} aria-label="Tilføj kommentar" style={compact ? {
          alignSelf: 'flex-start', width: 20, height: 20, padding: 0, borderRadius: 99, cursor: 'pointer',
          border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontSize: 13, lineHeight: 1,
        } : {
          alignSelf: 'flex-start', padding: '4px 10px', fontSize: 11, fontWeight: 500, borderRadius: 5, cursor: 'pointer',
          border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans, lineHeight: 1,
        }}>+{compact ? '' : ' Tilføj kommentar'}</button>
      )}
    </div>
  );
}

// Initiative create/edit drawer — slides in from right.
function UiInitiativeDrawer({ store, draft, onClose, onSave, onDelete }) {
  const [d, setD] = React.useState(draft);
  const [techOpen, setTechOpen] = React.useState(false);
  const [blockerOpen, setBlockerOpen] = React.useState(false);
  const [outcomeOpen, setOutcomeOpen] = React.useState(false);
  const [buOpen, setBuOpen] = React.useState(false);
  const [deptOpen, setDeptOpen] = React.useState(false);
  const [platOpen, setPlatOpen] = React.useState(false);
  React.useEffect(() => {
    setD(draft);
    setTechOpen(false);
    setBlockerOpen(false);
    setOutcomeOpen(false);
    setBuOpen(false);
    setDeptOpen(false);
    setPlatOpen(false);
  }, [draft?.id, draft?._new]);
  if (!d) return null;
  const bu = store.businessUnits.find((b) => b.id === d.buId) || store.businessUnits[0];
  const techCats = [...new Set(store.technologies.map((t) => t.category))];

  const patch = (k, v) => setD({ ...d, [k]: v });
  const assess = d.assessment || {};
  const setAssess = (key, sub) => setD((prev) => ({
    ...prev,
    assessment: { ...(prev.assessment || {}), [key]: { ...(prev.assessment?.[key] || {}), ...sub } },
  }));
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {store.businessUnits.filter((b) => b.id === d.buId).map((b) => (
              <span key={b.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontFamily: UI.sans, fontSize: 11, fontWeight: 600, lineHeight: 1,
                padding: '5px 10px', borderRadius: 5,
                background: b.accent, color: '#fff', border: `1.5px solid ${b.accent}`,
              }}>{b.name}</span>
            ))}
            <button onClick={() => setBuOpen(!buOpen)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
              fontFamily: UI.sans, fontSize: 11, fontWeight: 500, lineHeight: 1,
              background: 'transparent', color: UI.inkMuted, border: `1px dashed ${UI.border}`,
            }}>Skift {buOpen ? '▲' : '▾'}</button>
          </div>
          {buOpen && (
            <div style={{
              marginTop: 7, padding: '8px 10px', border: `1px solid ${UI.border}`, borderRadius: 6,
              background: UI.panelSoft, display: 'flex', flexWrap: 'wrap', gap: 5,
            }}>
              {store.businessUnits.map((b) => {
                const hot = d.buId === b.id;
                return (
                  <button key={b.id} onClick={() => { setD((prev) => ({ ...prev, buId: b.id })); setBuOpen(false); }} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: UI.sans, fontSize: 11, fontWeight: hot ? 600 : 400, lineHeight: 1,
                    padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                    background: hot ? b.accent : UI.panel,
                    color: hot ? '#fff' : UI.ink,
                    border: `1.5px solid ${hot ? b.accent : UI.border}`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: hot ? '#fff' : b.accent, opacity: hot ? 0.8 : 1, flex: '0 0 auto' }} />
                    {b.name}
                  </button>
                );
              })}
            </div>
          )}
        </UiFieldRow>

        {(() => {
          const buDepts = (store.departments || []).filter((dep) => dep.buId === d.buId);
          if (buDepts.length === 0) return null;
          const currentIds = d.departmentIds || [];
          const toggleDept = (id) => setD((prev) => ({
            ...prev,
            departmentIds: (prev.departmentIds || []).includes(id)
              ? (prev.departmentIds || []).filter((x) => x !== id)
              : [...(prev.departmentIds || []), id],
          }));
          return (
            <UiFieldRow label="Afdelinger" hint={currentIds.length > 0 ? `${currentIds.length} valgt` : 'ingen'}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                {(store.departments || []).filter((dep) => currentIds.includes(dep.id)).map((dep) => (
                  <span key={dep.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontFamily: UI.sans, fontSize: 11, fontWeight: 600, lineHeight: 1,
                    padding: '3px 6px 3px 9px', borderRadius: 4,
                    background: UI.inkMuted, color: '#fff', border: `1px solid ${UI.inkMuted}`,
                  }}>
                    {dep.name}
                    <button onClick={() => toggleDept(dep.id)} aria-label={`Fjern ${dep.name}`} style={{
                      background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
                      cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
                    }}>×</button>
                  </span>
                ))}
                <button onClick={() => setDeptOpen(!deptOpen)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: UI.sans, fontSize: 11, fontWeight: 500, lineHeight: 1,
                  background: 'transparent', color: UI.inkMuted, border: `1px dashed ${UI.border}`,
                }}>+ Tilføj {deptOpen ? '▲' : '▾'}</button>
              </div>
              {deptOpen && (
                <div style={{
                  marginTop: 7, padding: '8px 10px', border: `1px solid ${UI.border}`, borderRadius: 6,
                  background: UI.panelSoft, display: 'flex', flexWrap: 'wrap', gap: 5,
                }}>
                  {buDepts.map((dep) => {
                    const hot = currentIds.includes(dep.id);
                    return (
                      <button key={dep.id} onClick={() => toggleDept(dep.id)} style={{
                        fontFamily: UI.sans, fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                        background: hot ? UI.inkMuted : UI.panel,
                        color: hot ? '#fff' : UI.ink,
                        border: `1px solid ${hot ? UI.inkMuted : UI.border}`,
                        fontWeight: hot ? 600 : 400,
                      }}>{dep.name}</button>
                    );
                  })}
                </div>
              )}
            </UiFieldRow>
          );
        })()}

        {(store.platforms || []).length > 0 && (() => {
          const allPlatforms = store.platforms || [];
          const currentIds = d.platformIds || [];
          const togglePlatform = (id) => setD((prev) => ({
            ...prev,
            platformIds: (prev.platformIds || []).includes(id)
              ? (prev.platformIds || []).filter((x) => x !== id)
              : [...(prev.platformIds || []), id],
          }));
          return (
            <UiFieldRow label="Platforme" hint={currentIds.length > 0 ? `${currentIds.length} valgt` : 'ingen'}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                {allPlatforms.filter((p) => currentIds.includes(p.id)).map((p) => (
                  <span key={p.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontFamily: UI.mono, fontSize: 10.5, fontWeight: 500, lineHeight: 1,
                    padding: '3px 6px 3px 8px', borderRadius: 4,
                    background: UI.ink, color: '#fff', border: `1px solid ${UI.ink}`,
                  }}>
                    {p.name}
                    <button onClick={() => togglePlatform(p.id)} aria-label={`Fjern ${p.name}`} style={{
                      background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
                      cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
                    }}>×</button>
                  </span>
                ))}
                <button onClick={() => setPlatOpen(!platOpen)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: UI.sans, fontSize: 11, fontWeight: 500, lineHeight: 1,
                  background: 'transparent', color: UI.inkMuted, border: `1px dashed ${UI.border}`,
                }}>+ Tilføj {platOpen ? '▲' : '▾'}</button>
              </div>
              {platOpen && (
                <div style={{
                  marginTop: 7, padding: '8px 10px', border: `1px solid ${UI.border}`, borderRadius: 6,
                  background: UI.panelSoft, display: 'flex', flexWrap: 'wrap', gap: 5,
                }}>
                  {allPlatforms.map((p) => {
                    const hot = currentIds.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => togglePlatform(p.id)} style={{
                        fontFamily: UI.mono, fontSize: 10.5, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                        background: hot ? UI.ink : UI.panel,
                        color: hot ? '#fff' : UI.ink,
                        border: `1px solid ${hot ? UI.ink : UI.border}`,
                        fontWeight: 500,
                      }}>{p.name}</button>
                    );
                  })}
                </div>
              )}
            </UiFieldRow>
          );
        })()}

        <UiFieldRow label="Status">
          <UiSegmented value={d.status} options={store.statuses.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => patch('status', v)} />
        </UiFieldRow>

        {d.status === 'idea' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={!!d.testing} onChange={(e) => patch('testing', e.target.checked)}
              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: UI.ink }} />
            <span style={{ fontSize: 12, color: UI.ink, fontWeight: 500 }}>Afprøves</span>
          </label>
        )}

        <UiFieldRow label="Owner">
          <input value={d.owner} onChange={(e) => patch('owner', e.target.value)} style={uiInputStyle} />
        </UiFieldRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <UiFieldRow label="Start">
            <input type="date" value={d.start || ''} onChange={(e) => patch('start', e.target.value)} style={uiInputStyle} />
          </UiFieldRow>
          <UiFieldRow label="End" hint={d.end ? null : 'tom = løbende / BAU'}>
            <input type="date" value={d.end || ''} onChange={(e) => patch('end', e.target.value)} style={uiInputStyle} />
          </UiFieldRow>
        </div>

        <UiFieldRow label="Formål">
          <textarea value={d.purpose || ''} onChange={(e) => patch('purpose', e.target.value)}
            style={{ ...uiInputStyle, height: 55, resize: 'none', lineHeight: 1.45 }} />
        </UiFieldRow>

        <UiFieldRow label="Behov">
          <textarea value={d.need || ''} onChange={(e) => patch('need', e.target.value)}
            style={{ ...uiInputStyle, height: 55, resize: 'none', lineHeight: 1.45 }} />
        </UiFieldRow>

        <UiFieldRow label="Løsning">
          <textarea value={d.solution || ''} onChange={(e) => patch('solution', e.target.value)}
            style={{ ...uiInputStyle, height: 55, resize: 'none', lineHeight: 1.45 }} />
        </UiFieldRow>

        <UiFieldRow label="Technologies" hint={d.techIds.length > 0 ? `${d.techIds.length} valgt` : ''}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {store.technologies.filter((t) => d.techIds.includes(t.id)).map((t) => (
              <span key={t.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: UI.mono, fontSize: 10.5, lineHeight: 1,
                padding: '3px 6px 3px 8px', borderRadius: 4,
                background: UI.ink, color: '#fff', border: `1px solid ${UI.ink}`, fontWeight: 500,
              }}>
                {t.name}
                <button onClick={() => toggleTech(t.id)} style={{
                  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0,
                }}>×</button>
              </span>
            ))}
            <button onClick={() => setTechOpen(!techOpen)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
              fontFamily: UI.sans, fontSize: 11, fontWeight: 500, lineHeight: 1,
              background: 'transparent', color: UI.inkMuted,
              border: `1px dashed ${UI.border}`,
            }}>+ Tilføj {techOpen ? '▲' : '▾'}</button>
          </div>
          {techOpen && (
            <div style={{
              marginTop: 7, padding: '8px 10px 6px',
              border: `1px solid ${UI.border}`, borderRadius: 6,
              background: UI.panelSoft, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
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
                          background: hot ? UI.ink : UI.panel,
                          color: hot ? '#fff' : UI.ink,
                          border: `1px solid ${hot ? UI.ink : UI.border}`,
                          fontWeight: hot ? 600 : 400,
                        }}>{t.name}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </UiFieldRow>

        <UiFieldRow label="Blockers" hint={(d.blockerIds || []).length > 0 ? `${(d.blockerIds || []).length} valgt` : ''}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {(store.blockers || []).filter((b) => (d.blockerIds || []).includes(b.id)).map((b) => (
              <span key={b.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: UI.mono, fontSize: 10.5, lineHeight: 1,
                padding: '3px 6px 3px 8px', borderRadius: 4,
                background: 'oklch(0.45 0.18 15)', color: '#fff',
                border: '1px solid oklch(0.45 0.18 15)', fontWeight: 500,
              }}>
                ⚠ {b.name}
                <button onClick={() => patch('blockerIds', (d.blockerIds || []).filter((x) => x !== b.id))} style={{
                  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0,
                }}>×</button>
              </span>
            ))}
            <button onClick={() => setBlockerOpen(!blockerOpen)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
              fontFamily: UI.sans, fontSize: 11, fontWeight: 500, lineHeight: 1,
              background: 'transparent', color: UI.inkMuted,
              border: `1px dashed ${UI.border}`,
            }}>+ Tilføj {blockerOpen ? '▲' : '▾'}</button>
          </div>
          {blockerOpen && (
            <div style={{
              marginTop: 7, padding: '8px 10px 6px',
              border: `1px solid ${UI.border}`, borderRadius: 6,
              background: UI.panelSoft, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
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
                          background: hot ? 'oklch(0.45 0.18 15)' : UI.panel,
                          color: hot ? '#fff' : UI.ink,
                          border: `1px solid ${hot ? 'oklch(0.45 0.18 15)' : UI.border}`,
                          fontWeight: hot ? 600 : 400,
                        }}>⚠ {b.name}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </UiFieldRow>

        <UiFieldRow label="Outcomes" hint={(d.outcomeIds || []).length > 0 ? `${(d.outcomeIds || []).length} valgt` : ''}>
          {(store.outcomes || []).length === 0 ? (
            <div style={{ fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>Ingen outcomes defineret. Tilføj dem i Catalogue → Outcomes.</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                {(store.outcomes || []).filter((o) => (d.outcomeIds || []).includes(o.id)).map((o) => {
                  const oc = `oklch(0.48 0.13 ${o.colorHue})`;
                  return (
                    <span key={o.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontFamily: UI.mono, fontSize: 10.5, lineHeight: 1,
                      padding: '3px 6px 3px 8px', borderRadius: 4,
                      background: oc, color: '#fff', border: `1px solid ${oc}`, fontWeight: 500,
                    }}>
                      {o.name}
                      <button onClick={() => patch('outcomeIds', (d.outcomeIds || []).filter((x) => x !== o.id))} style={{
                        background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0,
                      }}>×</button>
                    </span>
                  );
                })}
                <button onClick={() => setOutcomeOpen(!outcomeOpen)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: UI.sans, fontSize: 11, fontWeight: 500, lineHeight: 1,
                  background: 'transparent', color: UI.inkMuted,
                  border: `1px dashed ${UI.border}`,
                }}>+ Tilføj {outcomeOpen ? '▲' : '▾'}</button>
              </div>
              {outcomeOpen && (
                <div style={{
                  marginTop: 7, padding: '8px 10px 6px',
                  border: `1px solid ${UI.border}`, borderRadius: 6,
                  background: UI.panelSoft, display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {[...new Set((store.outcomes || []).map((o) => o.category))].map((cat) => {
                    const catOutcomes = (store.outcomes || []).filter((o) => o.category === cat);
                    const firstHue = catOutcomes[0]?.colorHue ?? 155;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, display: 'inline-block', background: `oklch(0.58 0.13 ${firstHue})` }} />
                          <div style={{ fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase', color: UI.inkFaint }}>{cat}</div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {catOutcomes.map((o) => {
                            const hot = (d.outcomeIds || []).includes(o.id);
                            const oc = `oklch(0.48 0.13 ${o.colorHue})`;
                            return (
                              <button key={o.id} onClick={() => {
                                const next = hot
                                  ? (d.outcomeIds || []).filter((x) => x !== o.id)
                                  : [...(d.outcomeIds || []), o.id];
                                patch('outcomeIds', next);
                              }} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontFamily: UI.mono, fontSize: 10.5, lineHeight: 1,
                                padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                                background: hot ? oc : UI.panel,
                                color: hot ? '#fff' : UI.ink,
                                border: `1px solid ${hot ? oc : UI.border}`,
                                fontWeight: hot ? 600 : 400,
                              }}>{o.name}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
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

        <details style={{ borderTop: `1px solid ${UI.border}` }}>
          <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 0', userSelect: 'none' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: UI.ink, flexShrink: 0 }}>Vurdering</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: UI.inkFaint }}>
              {[assess.value?.score, commentsOf(assess.ownership).length, commentsOf(assess.strategy).length, assess.readiness?.ready, assess.ttv?.score].filter(Boolean).length} af 5 udfyldt
            </span>
            <span aria-hidden="true" style={{ fontSize: 10, color: UI.inkFaint }}>▾</span>
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '2px 0 16px' }}>

        <UiFieldRow label="01 Værdipotentiale" hint="1 lille · 5 stor gevinst">
          <UiSegmented
            value={assess.value?.score ?? 0}
            options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 0 ? '–' : String(n) }))}
            onChange={(v) => setAssess('value', { score: v || null })} />
          <UiComments comments={commentsOf(assess.value)} onChange={(next) => setAssess('value', { comments: next })} />
        </UiFieldRow>

        <UiFieldRow label="02 Realiserbarhed og ejerskab">
          <UiComments comments={commentsOf(assess.ownership)} onChange={(next) => setAssess('ownership', { comments: next })} />
        </UiFieldRow>

        <UiFieldRow label="03 Strategisk betydning" hint="YouSee-mål / AI-board">
          <UiComments comments={commentsOf(assess.strategy)} onChange={(next) => setAssess('strategy', { comments: next })} />
        </UiFieldRow>

        <UiFieldRow label="04 Data, teknologi og governance">
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', marginBottom: 6 }}>
            <input type="checkbox" checked={!!assess.readiness?.ready}
              onChange={(e) => setAssess('readiness', { ready: e.target.checked })}
              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: UI.ink }} />
            <span style={{ fontSize: 12, color: UI.ink, fontWeight: 500 }}>Governance-klar (data tilgængelig og tilladt)</span>
          </label>
          <UiComments comments={commentsOf(assess.readiness)} onChange={(next) => setAssess('readiness', { comments: next })} />
        </UiFieldRow>

        <UiFieldRow label="05 Time-to-value og skalerbarhed" hint="1 langsom · 5 hurtig">
          <UiSegmented
            value={assess.ttv?.score ?? 0}
            options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 0 ? '–' : String(n) }))}
            onChange={(v) => setAssess('ttv', { score: v || null })} />
          <UiComments comments={commentsOf(assess.ttv)} onChange={(next) => setAssess('ttv', { comments: next })} />
        </UiFieldRow>
          </div>
        </details>
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

// ── Color helpers ─────────────────────────────────────────────────────────────
function pickDistinctHue(existingHues) {
  const valid = (existingHues || []).filter((h) => h != null && !isNaN(h));
  if (!valid.length) return 220;
  const sorted = [...new Set(valid)].sort((a, b) => a - b);
  if (sorted.length === 1) return Math.round((sorted[0] + 180) % 360);
  let maxGap = 0, bestHue = sorted[0];
  for (let i = 0; i < sorted.length; i++) {
    const gap = (sorted[(i + 1) % sorted.length] - sorted[i] + 360) % 360;
    if (gap > maxGap) { maxGap = gap; bestHue = Math.round((sorted[i] + gap / 2) % 360); }
  }
  return bestHue;
}

function hueFromOklch(str) {
  const m = String(str || '').match(/oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

function HuePicker({ hue, onChange }) {
  const h = hue ?? 220;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: '1px solid rgba(0,0,0,.12)', background: `oklch(0.55 0.18 ${h})` }} />
      <input
        type="range" min={0} max={359} value={h}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          flex: 1, height: 10, borderRadius: 5, cursor: 'pointer', border: 'none', outline: 'none',
          background: 'linear-gradient(to right,oklch(0.55 0.18 0),oklch(0.55 0.18 45),oklch(0.55 0.18 90),oklch(0.55 0.18 135),oklch(0.55 0.18 180),oklch(0.55 0.18 225),oklch(0.55 0.18 270),oklch(0.55 0.18 315),oklch(0.55 0.18 359))',
          WebkitAppearance: 'none', appearance: 'none', padding: 0,
        }}
      />
    </div>
  );
}

// Catalogue CRUD drawer — BUs, Departments, Platforms, Technologies, Blockers, Outcomes.
function UiCatalogueDrawer({
  store, onClose,
  onSaveBU, onDelBU,
  onSaveDepartment, onDelDepartment,
  onSavePlatform, onDelPlatform,
  onSaveTech, onDelTech,
  onSaveBlocker, onDelBlocker,
  onSaveOutcome, onDelOutcome,
}) {
  const TABS = ['BUs', 'Afdelinger', 'Platforme', 'Technologies', 'Blockers', 'Outcomes'];
  const [tab, setTab] = React.useState('BUs');
  const [editing, setEditing] = React.useState(null); // { kind, id } or null
  const [editDraft, setEditDraft] = React.useState({});
  const [addDraft, setAddDraft] = React.useState({});
  const [addOpen, setAddOpen] = React.useState(false);
  const [err, setErr] = React.useState('');

  const switchTab = (t) => { setTab(t); setEditing(null); setAddDraft({}); setAddOpen(false); setErr(''); };

  const startEdit = (item) => { setEditing({ id: item.id }); setEditDraft({ ...item }); setErr(''); };
  const cancelEdit = () => { setEditing(null); setEditDraft({}); setErr(''); };
  const openAdd = (defaults = {}) => { setAddDraft(defaults); setAddOpen(true); setEditing(null); setErr(''); };
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
            <UiFieldRow label="Farve">
              <HuePicker hue={hueFromOklch(editDraft.accent) ?? 220} onChange={(h) => ep('accent', `oklch(0.48 0.12 ${h})`)} />
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
          <UiFieldRow label="Farve">
            <HuePicker hue={hueFromOklch(addDraft.accent) ?? 220} onChange={(h) => ap('accent', `oklch(0.48 0.12 ${h})`)} />
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
        <button onClick={() => { const hue = pickDistinctHue(store.businessUnits.map((b) => hueFromOklch(b.accent))); openAdd({ accent: `oklch(0.48 0.12 ${hue})` }); }} style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 5, border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans }}>+ Add business unit</button>
      )}
    </>
  );

  // ── Platforms ────────────────────────────────────────────────────────────────
  const renderPlatforms = () => (
    <>
      {(store.platforms || []).map((p) => {
        const isEd = editing?.id === p.id;
        if (isEd) return (
          <div key={p.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '8px 0' }}>
            <UiFieldRow label="Name"><input value={editDraft.name || ''} onChange={(e) => ep('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
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
          <div key={p.id} style={rowStyle}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: UI.ink }}>{p.name}</div>
            {actionBtn('✎', () => startEdit(p))}
            {actionBtn('×', () => { onDelPlatform(p.id); setErr(''); }, 'oklch(0.55 0.18 25)')}
          </div>
        );
      })}
      {err && <div style={{ fontSize: 11, color: 'oklch(0.52 0.2 15)', padding: '4px 0' }}>{err}</div>}
      {addOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: `1px dashed ${UI.border}`, marginTop: 4 }}>
          <UiFieldRow label="Name"><input value={addDraft.name || ''} onChange={(e) => ap('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {actionBtn('Cancel', cancelAdd)}
            <UiButton size="sm" variant="primary" onClick={() => {
              if (!addDraft.name?.trim()) { setErr('Name is required'); return; }
              onSavePlatform({ id: randId('p_'), name: addDraft.name.trim() });
              cancelAdd();
            }}>Add platform</UiButton>
          </div>
        </div>
      ) : (
        <button onClick={openAdd} style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 5, border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans }}>+ Add platform</button>
      )}
    </>
  );

  // ── Tech / Blocker / Outcome shared list ─────────────────────────────────────
  const renderCatList = (items, isBlocker, customSave, customDel, customPrefix, customLabel) => {
    const onSave = customSave ?? (isBlocker ? onSaveBlocker : onSaveTech);
    const onDel  = customDel  ?? (isBlocker ? onDelBlocker  : onDelTech);
    const prefix = customPrefix ?? (isBlocker ? 'b_' : 't_');
    const label  = customLabel  ?? (isBlocker ? 'blocker' : 'technology');
    const existingCats = [...new Set(items.map((x) => x.category).filter(Boolean))];
    return (
      <>
        {items.map((item) => {
          const isEd = editing?.id === item.id;
          const hue = item.colorHue ?? (isBlocker ? 15 : 250);
          const dotColor = isBlocker ? `oklch(0.62 0.18 ${hue})` : `oklch(0.62 0.12 ${hue})`;
          if (isEd) return (
            <div key={item.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '8px 0' }}>
              <UiFieldRow label="Name"><input value={editDraft.name || ''} onChange={(e) => ep('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
              <UiFieldRow label="Farve">
                <HuePicker hue={editDraft.colorHue ?? 220} onChange={(h) => ep('colorHue', h)} />
              </UiFieldRow>
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
            <UiFieldRow label="Name"><input value={addDraft.name || ''} onChange={(e) => ap('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
            <UiFieldRow label="Farve">
              <HuePicker hue={addDraft.colorHue ?? 220} onChange={(h) => ap('colorHue', h)} />
            </UiFieldRow>
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
          <button onClick={() => openAdd({ colorHue: pickDistinctHue(items.map((i) => i.colorHue)) })} style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 5, border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans }}>+ Add {label}</button>
        )}
      </>
    );
  };

  // ── Departments (grouped by BU) ──────────────────────────────────────────────
  const renderDepartments = () => (
    <>
      {store.businessUnits.map((bu) => {
        const deptList = (store.departments || []).filter((dep) => dep.buId === bu.id);
        if (deptList.length === 0 && !addOpen) return null;
        return (
          <div key={bu.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: bu.accent }} />
              <span style={{ fontFamily: UI.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: bu.accent }}>{bu.name}</span>
            </div>
            {deptList.map((dep) => {
              const isEd = editing?.id === dep.id;
              if (isEd) return (
                <div key={dep.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '8px 0 8px 14px' }}>
                  <UiFieldRow label="Navn"><input value={editDraft.name || ''} onChange={(e) => ep('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {actionBtn('Cancel', cancelEdit)}
                    <UiButton size="sm" variant="primary" onClick={() => {
                      if (!editDraft.name?.trim()) { setErr('Name is required'); return; }
                      onSaveDepartment(editDraft); cancelEdit();
                    }}>Save</UiButton>
                  </div>
                </div>
              );
              return (
                <div key={dep.id} style={{ ...rowStyle, paddingLeft: 14 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: UI.ink }}>{dep.name}</div>
                  {actionBtn('✎', () => startEdit(dep))}
                  {actionBtn('×', () => { onDelDepartment(dep.id); setErr(''); }, 'oklch(0.55 0.18 25)')}
                </div>
              );
            })}
          </div>
        );
      })}
      {err && <div style={{ fontSize: 11, color: 'oklch(0.52 0.2 15)', padding: '4px 0' }}>{err}</div>}
      {addOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: `1px dashed ${UI.border}`, marginTop: 4 }}>
          <UiFieldRow label="Navn"><input value={addDraft.name || ''} onChange={(e) => ap('name', e.target.value)} style={inputSm} autoFocus /></UiFieldRow>
          <UiFieldRow label="Forretningsenhed">
            <UiSegmented value={addDraft.buId || store.businessUnits[0]?.id} options={store.businessUnits.map((b) => ({ value: b.id, label: b.name }))} onChange={(v) => ap('buId', v)} />
          </UiFieldRow>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {actionBtn('Cancel', cancelAdd)}
            <UiButton size="sm" variant="primary" onClick={() => {
              if (!addDraft.name?.trim()) { setErr('Name is required'); return; }
              onSaveDepartment({ id: randId('dep_'), name: addDraft.name.trim(), buId: addDraft.buId || store.businessUnits[0]?.id });
              cancelAdd();
            }}>Tilføj afdeling</UiButton>
          </div>
        </div>
      ) : (
        <button onClick={openAdd} style={{ marginTop: 8, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 5, border: `1px dashed ${UI.border}`, background: 'transparent', color: UI.inkMuted, fontFamily: UI.sans }}>+ Tilføj afdeling</button>
      )}
    </>
  );

  const content = {
    'BUs':          renderBUs(),
    'Afdelinger':   renderDepartments(),
    'Platforme':    renderPlatforms(),
    'Technologies': renderCatList(store.technologies || [], false),
    'Blockers':     renderCatList(store.blockers || [], true),
    'Outcomes':     renderCatList(store.outcomes || [], false, onSaveOutcome, onDelOutcome, 'o_', 'outcome'),
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

// ── Portfolio helpers (used only by UiPortfolioView) ─────────────────────────
const _pfLabel = { fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint };
const _pfWarn  = 'oklch(0.55 0.15 50)';
const _pfCard  = { background: UI.panel, border: `1px solid ${UI.border}`, borderRadius: 10, boxShadow: UI.shadow, padding: '14px 16px', minWidth: 0 };

// Statuses shown in the portfolio, in store order, without 'idea'. Unknown
// statuses found on initiatives are appended so nothing silently disappears.
function _pfStatuses(store) {
  const list = ((store.statuses && store.statuses.length) ? store.statuses : STATUSES).filter((s) => s.id !== 'idea');
  const known = new Set(list.map((s) => s.id));
  const extra = [...new Set((store.initiatives || []).map((i) => i.status))]
    .filter((id) => id !== 'idea' && !known.has(id))
    .map((id) => resolveStatus(id, store.statuses));
  return [...list, ...extra];
}

const _pfBlocked = (i) => (i.blockerIds || []).length > 0;

function UiPfKpi({ label, value, sub, tone, active, onClick }) {
  const color = tone || UI.ink;
  return (
    <div onClick={onClick} title={onClick ? 'Vis initiativerne' : undefined}
      style={{
        ..._pfCard, padding: '12px 14px', cursor: onClick ? 'pointer' : 'default',
        borderColor: active ? UI.ink : UI.border,
        boxShadow: active ? `0 0 0 2px color-mix(in oklch, ${UI.ink} 12%, transparent)` : UI.shadow,
        transition: 'border-color .12s, box-shadow .12s',
      }}
      onMouseEnter={(e) => { if (onClick && !active) e.currentTarget.style.borderColor = UI.borderStrong; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = UI.border; }}>
      <div style={_pfLabel}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: -0.6, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: UI.inkMuted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// Horizontal stacked bars: one row per group, one segment per status.
// rows: [{ key, label, dot, inits }]. onPick(key, title, inits).
function UiPfStackedBars({ rows, statuses, selKey, onPick, showBlocked = true }) {
  const max = Math.max(1, ...rows.map((r) => r.inits.length));
  if (rows.length === 0) return <div style={{ fontSize: 12, color: UI.inkFaint, fontStyle: 'italic' }}>Ingen data</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r) => {
        const blocked = r.inits.filter(_pfBlocked).length;
        const rowKey = `row:${r.key}`;
        return (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={() => onPick(rowKey, r.label, r.inits)} title={`Vis alle ${r.inits.length} i ${r.label}`}
              style={{
                width: 130, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                fontSize: 11.5, color: UI.ink, fontWeight: selKey === rowKey ? 700 : 500, minWidth: 0,
              }}>
              {r.dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: r.dot, flex: '0 0 auto' }} />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
            </div>
            <div style={{ flex: 1, minWidth: 60, height: 16, display: 'flex' }}>
              <div style={{ width: `${(r.inits.length / max) * 100}%`, display: 'flex', gap: 1, borderRadius: 4, overflow: 'hidden' }}>
                {statuses.map((s) => {
                  const segInits = r.inits.filter((i) => i.status === s.id);
                  if (!segInits.length) return null;
                  const k = `seg:${r.key}:${s.id}`;
                  const dim = selKey && selKey.startsWith('seg:') && selKey !== k;
                  return (
                    <div key={s.id} onClick={() => onPick(k, `${r.label} · ${s.label}`, segInits)}
                      title={`${r.label} · ${s.label}: ${segInits.length}`}
                      style={{
                        flex: segInits.length, background: s.color, cursor: 'pointer',
                        opacity: dim ? 0.35 : 1, transition: 'opacity .12s',
                        color: '#fff', fontFamily: UI.mono, fontSize: 9.5, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      }}>{segInits.length}</div>
                  );
                })}
              </div>
            </div>
            <span style={{ width: 22, textAlign: 'right', fontFamily: UI.mono, fontSize: 11, fontWeight: 700, color: UI.inkMuted }}>{r.inits.length}</span>
            <span title={blocked ? `${blocked} blokeret` : ''} style={{ width: 30, fontFamily: UI.mono, fontSize: 10, color: _pfWarn, fontWeight: 600 }}>
              {showBlocked && blocked > 0 ? `⚠${blocked}` : ''}
            </span>
          </div>
        );
      })}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4, paddingLeft: 138 }}>
        {statuses.map((s) => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: UI.inkMuted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />{s.label}
          </span>
        ))}
        {showBlocked && <span style={{ fontSize: 10.5, color: _pfWarn }}>⚠ = blokeret</span>}
      </div>
    </div>
  );
}

// ── Portfolio / Outcome pillar view ──────────────────────────────────────────
function UiPortfolioView({ store, onOpenInit }) {
  const outcomes   = store.outcomes || [];
  const pillars    = [...new Set(outcomes.map((o) => o.category))];
  const buById     = _byId(store.businessUnits);
  const outcomeById = _byId(outcomes);
  const inits      = store.initiatives || [];
  const statuses   = _pfStatuses(store);

  // Selection from a KPI tile, bar segment or heatmap cell. Ids (not objects)
  // are kept, so the list stays live when the store changes underneath.
  const [sel, setSel] = React.useState(null);      // { key, title, ids }
  const [dim, setDim] = React.useState('bu');      // stacked bars grouped by: bu | tech | blocker
  const pick = (key, title, list) =>
    setSel((cur) => cur && cur.key === key ? null : { key, title, ids: list.map((i) => i.id) });
  const selInits = sel ? inits.filter((i) => sel.ids.includes(i.id)) : [];
  const selRef = React.useRef(null);
  React.useEffect(() => {
    if (sel && selRef.current && selRef.current.scrollIntoView) selRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [sel && sel.key]);

  // ── Key figures ──
  const blockedInits = inits.filter(_pfBlocked);
  const prodInits    = inits.filter((i) => i.status === 'prod');
  const noOutcome    = inits.filter((i) => !(i.outcomeIds || []).length);
  const pct = (n) => inits.length ? `${Math.round((n / inits.length) * 100)} %` : '–';

  // ── Stacked bar rows for the chosen dimension ──
  const barRows = (() => {
    if (dim === 'bu') {
      const rows = (store.businessUnits || []).map((bu) => ({
        key: bu.id, label: bu.name, dot: bu.accent, inits: inits.filter((i) => i.buId === bu.id),
      }));
      const orphans = inits.filter((i) => !buById[i.buId]);
      if (orphans.length) rows.push({ key: '_none', label: 'Uden forretningsenhed', inits: orphans });
      return rows.filter((r) => r.inits.length);
    }
    const catalogue = dim === 'tech' ? (store.technologies || []) : (store.blockers || []);
    const field     = dim === 'tech' ? 'techIds' : 'blockerIds';
    const rows = catalogue
      .map((c) => ({ key: c.id, label: c.name, dot: `oklch(0.58 0.13 ${c.colorHue ?? 250})`, inits: inits.filter((i) => (i[field] || []).includes(c.id)) }))
      .filter((r) => r.inits.length)
      .sort((a, b) => b.inits.length - a.inits.length);
    if (dim === 'tech') {
      const none = inits.filter((i) => !(i.techIds || []).length);
      if (none.length) rows.push({ key: '_none', label: 'Ingen teknologi', inits: none });
    }
    return rows;
  })();

  // ── Heatmap: forretningsenhed × outcome-søjle ──
  const heatBUs = (store.businessUnits || []).filter((bu) => inits.some((i) => i.buId === bu.id));
  const pillarOf = (i) => new Set((i.outcomeIds || []).map((oid) => outcomeById[oid]?.category).filter(Boolean));
  const cellInits = (buId, pillar) => inits.filter((i) => i.buId === buId && pillarOf(i).has(pillar));
  const heatMax = Math.max(1, ...heatBUs.flatMap((bu) => pillars.map((p) => cellInits(bu.id, p).length)));

  // First colorHue per pillar
  const pillarHue = {};
  for (const o of outcomes) {
    if (pillarHue[o.category] == null) pillarHue[o.category] = o.colorHue;
  }

  // Initiatives without any outcomeIds
  const uninit = store.initiatives.filter((i) => !(i.outcomeIds || []).length);
  const withOutcomes = store.initiatives.filter((i) => (i.outcomeIds || []).length > 0);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: UI.sans }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: UI.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: UI.inkFaint, marginBottom: 5 }}>Portfolio Value</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: UI.ink, letterSpacing: -0.3 }}>Hvilken værdi skaber AI-porteføljen?</div>
        <div style={{ fontSize: 12, color: UI.inkMuted, marginTop: 4 }}>
          {withOutcomes.length} af {store.initiatives.length} initiativer har registreret outcomes
          {uninit.length > 0 && <span style={{ color: 'oklch(0.62 0.14 70)', marginLeft: 6 }}>· {uninit.length} mangler</span>}
        </div>
      </div>

      {/* ── Key figures ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <UiPfKpi label="Initiativer" value={inits.length}
          sub={statuses.map((s) => `${inits.filter((i) => i.status === s.id).length} ${s.label}`).join(' · ')}
          active={sel?.key === 'kpi:all'} onClick={() => pick('kpi:all', 'Alle initiativer', inits)} />
        <UiPfKpi label="I produktion" value={prodInits.length} sub={`${pct(prodInits.length)} af porteføljen`}
          tone={resolveStatus('prod', store.statuses).color}
          active={sel?.key === 'kpi:prod'} onClick={() => pick('kpi:prod', 'I produktion', prodInits)} />
        <UiPfKpi label="Blokeret" value={blockedInits.length} sub={`${pct(blockedInits.length)} har mindst én blocker`}
          tone={blockedInits.length ? _pfWarn : UI.ink}
          active={sel?.key === 'kpi:blocked'} onClick={() => pick('kpi:blocked', 'Blokerede initiativer', blockedInits)} />
        <UiPfKpi label="Uden outcomes" value={noOutcome.length} sub={noOutcome.length ? 'Værdien er ikke beskrevet' : 'Alle har outcomes'}
          tone={noOutcome.length ? 'oklch(0.62 0.14 70)' : UI.ink}
          active={sel?.key === 'kpi:noout'} onClick={() => pick('kpi:noout', 'Uden outcomes', noOutcome)} />
      </div>

      {/* ── Distribution charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, alignItems: 'start' }}>
        <div style={_pfCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: UI.ink, flex: '1 1 auto' }}>Status fordelt på</div>
            <div style={{ width: 280, maxWidth: '100%' }}>
              <UiSegmented value={dim} onChange={(v) => setDim(v)} options={[
                { value: 'bu', label: 'Forretningsenhed' }, { value: 'tech', label: 'Teknologi' }, { value: 'blocker', label: 'Blocker' },
              ]} />
            </div>
          </div>
          <UiPfStackedBars rows={barRows} statuses={statuses} selKey={sel?.key} onPick={pick} showBlocked={dim !== 'blocker'} />
          {dim === 'blocker' && (
            <div style={{ fontSize: 10.5, color: UI.inkFaint, marginTop: 8 }}>Et initiativ med flere blockere tælles med under hver af dem.</div>
          )}
        </div>

        <div style={_pfCard}>
          <div style={{ fontSize: 13, fontWeight: 600, color: UI.ink, marginBottom: 12 }}>Forretningsenhed × outcome-søjle</div>
          {pillars.length === 0 || heatBUs.length === 0 ? (
            <div style={{ fontSize: 12, color: UI.inkFaint, fontStyle: 'italic' }}>Ingen data</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th />
                    {pillars.map((p) => (
                      <th key={p} style={{ fontWeight: 600, color: `oklch(0.46 0.13 ${pillarHue[p] ?? 200})`, fontSize: 10.5, padding: '0 4px 4px', textAlign: 'center', lineHeight: 1.25 }}>{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatBUs.map((bu) => (
                    <tr key={bu.id}>
                      <td style={{ whiteSpace: 'nowrap', paddingRight: 6, color: UI.ink }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><UiBuDot bu={bu} size={7} />{bu.name}</span>
                      </td>
                      {pillars.map((p) => {
                        const list = cellInits(bu.id, p);
                        const n = list.length;
                        const t = n / heatMax;
                        const hue = pillarHue[p] ?? 200;
                        const k = `heat:${bu.id}:${p}`;
                        const active = sel?.key === k;
                        return (
                          <td key={p}
                            onClick={() => n && pick(k, `${bu.name} · ${p}`, list)}
                            title={`${bu.name} · ${p}: ${n} initiativ${n === 1 ? '' : 'er'}`}
                            style={{
                              height: 30, minWidth: 44, textAlign: 'center', borderRadius: 5,
                              fontFamily: UI.mono, fontWeight: 600,
                              cursor: n ? 'pointer' : 'default',
                              background: n ? `oklch(${(0.95 - 0.4 * t).toFixed(3)} ${(0.03 + 0.11 * t).toFixed(3)} ${hue})` : UI.panelSoft,
                              color: n ? (t > 0.5 ? '#fff' : `oklch(0.4 0.12 ${hue})`) : UI.inkFaint,
                              outline: active ? `2px solid ${UI.ink}` : 'none', outlineOffset: -1,
                            }}>{n || '·'}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 10.5, color: UI.inkFaint, marginTop: 6 }}>Antal initiativer med mindst ét outcome i søjlen. Klik på en celle for at se dem.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Selected initiatives ── */}
      {sel && (
        <div ref={selRef} style={{ ..._pfCard, flex: '0 0 auto', padding: 0, overflow: 'hidden', borderColor: UI.borderStrong }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: UI.panelSoft, borderBottom: `1px solid ${UI.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: UI.ink }}>{sel.title}</div>
            <span style={{ fontFamily: UI.mono, fontSize: 11, color: UI.inkMuted }}>{selInits.length}</span>
            <div style={{ flex: 1 }} />
            <UiButton size="sm" variant="bare" onClick={() => setSel(null)} title="Luk listen">✕ Luk</UiButton>
          </div>
          {selInits.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 12, color: UI.inkFaint, fontStyle: 'italic' }}>Ingen initiativer</div>
          ) : selInits.map((i) => {
            const bu = buById[i.buId];
            const blockerNames = (i.blockerIds || []).map((b) => (store.blockers || []).find((x) => x.id === b)?.name).filter(Boolean);
            return (
              <div key={i.id} onClick={() => onOpenInit && onOpenInit(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: `1px solid ${UI.border}`, cursor: onOpenInit ? 'pointer' : 'default' }}
                onMouseEnter={(e) => { if (onOpenInit) e.currentTarget.style.background = UI.panelSoft; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                {bu && <UiBuDot bu={bu} size={7} />}
                <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: 12, fontWeight: 500, color: UI.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                {i.owner && <span style={{ fontSize: 11, color: UI.inkFaint, whiteSpace: 'nowrap' }}>{i.owner}</span>}
                {blockerNames.length > 0 && (
                  <span title={blockerNames.join(', ')} style={{ fontSize: 10.5, color: _pfWarn, fontWeight: 600, whiteSpace: 'nowrap' }}>⚠ {blockerNames.length}</span>
                )}
                <UiStatusPill status={i.status} statuses={store.statuses} size="sm" />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ ..._pfLabel, marginBottom: -8 }}>Outcome-søjler</div>

      {/* Pillar cards */}
      {pillars.length === 0 ? (
        <div style={{ color: UI.inkFaint, fontSize: 13 }}>Ingen outcomes defineret. Gå til Catalogue → Outcomes for at tilføje.</div>
      ) : (
        <div style={{
          display: 'grid',
          // At most 4 columns, but wrap rather than overflow on narrow screens.
          gridTemplateColumns: `repeat(auto-fit, minmax(max(200px, calc((100% - ${(Math.min(pillars.length, 4) - 1) * 14}px) / ${Math.min(pillars.length, 4)})), 1fr))`,
          gap: 14, alignItems: 'start',
        }}>
          {pillars.map((pillar) => {
            const pillarOutcomes = outcomes.filter((o) => o.category === pillar);
            const hue = pillarHue[pillar] ?? 200;
            const pillarColor  = `oklch(0.46 0.13 ${hue})`;
            const pillarBg     = `oklch(0.97 0.025 ${hue})`;
            const pillarBorder = `oklch(0.88 0.06 ${hue})`;

            // Initiatives targeting this pillar
            const inits = store.initiatives.filter((i) =>
              (i.outcomeIds || []).some((oid) => {
                const o = outcomeById[oid];
                return o && o.category === pillar;
              })
            );

            const counts = { idea: 0, poc: 0, pilot: 0, live: 0 };
            for (const i of inits) counts[i.status] = (counts[i.status] || 0) + 1;

            return (
              <div key={pillar} style={{
                background: UI.panel,
                border: `1px solid ${pillarBorder}`,
                borderRadius: 10, overflow: 'hidden',
                boxShadow: UI.shadowMd,
              }}>
                {/* Pillar header */}
                <div style={{ background: pillarBg, padding: '12px 14px', borderBottom: `1px solid ${pillarBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: pillarColor, marginBottom: 8 }}>{pillar}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {pillarOutcomes.map((o) => (
                      <span key={o.id} style={{
                        fontFamily: UI.mono, fontSize: 9, fontWeight: 500,
                        padding: '2px 6px', borderRadius: 3,
                        background: `oklch(0.5 0.1 ${o.colorHue} / 0.14)`,
                        color: `oklch(0.4 0.13 ${o.colorHue})`,
                        border: `1px solid oklch(0.5 0.1 ${o.colorHue} / 0.28)`,
                      }}>{o.name}</span>
                    ))}
                  </div>
                </div>

                {/* Status summary bar */}
                <div style={{
                  padding: '7px 14px', borderBottom: `1px solid ${UI.border}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontFamily: UI.mono, fontSize: 13, fontWeight: 700, color: pillarColor }}>{inits.length}</span>
                  <span style={{ fontFamily: UI.mono, fontSize: 9.5, color: UI.inkFaint }}>initiativer</span>
                  <div style={{ flex: 1 }} />
                  {STATUSES.map((s) => counts[s.id] > 0 && (
                    <span key={s.id} title={s.label} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontFamily: UI.mono, fontSize: 9.5, color: s.color,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: 99, background: s.color, flex: '0 0 auto' }} />
                      {counts[s.id]}
                    </span>
                  ))}
                </div>

                {/* Initiative list */}
                <div>
                  {inits.length === 0 ? (
                    <div style={{ padding: '10px 14px', fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>Ingen initiativer endnu</div>
                  ) : inits.map((i) => {
                    const bu = buById[i.buId];
                    const myOutcomes = pillarOutcomes.filter((o) => (i.outcomeIds || []).includes(o.id));
                    return (
                      <div key={i.id}
                        onClick={() => onOpenInit && onOpenInit(i)}
                        style={{
                          padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 7,
                          borderBottom: `1px solid color-mix(in oklch, ${UI.border} 55%, transparent)`,
                          cursor: onOpenInit ? 'pointer' : 'default',
                        }}
                        onMouseEnter={(e) => { if (onOpenInit) e.currentTarget.style.background = UI.panelSoft; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        {bu && <UiBuDot bu={bu} size={6} />}
                        <div style={{
                          flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 500, color: UI.ink,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{i.name}</div>
                        <UiStatusPill status={i.status} statuses={store.statuses} size="sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Initiatives without outcomes */}
      {uninit.length > 0 && (
        <div>
          <div style={{ fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint, marginBottom: 8 }}>
            Mangler outcomes ({uninit.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {uninit.map((i) => {
              const bu = buById[i.buId];
              return (
                <div key={i.id}
                  onClick={() => onOpenInit && onOpenInit(i)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 5,
                    border: `1.5px dashed ${UI.border}`, background: UI.panel,
                    fontSize: 11, color: UI.inkMuted,
                    cursor: onOpenInit ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = UI.borderStrong; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = UI.border; }}>
                  {bu && <UiBuDot bu={bu} size={5} />}
                  {i.name}
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  UiCategoryDot, UiBuDot, UiInitiativeDrawer, UiCatalogueDrawer, UiPortfolioView, UiFieldRow,
  UiSegmented, uiInputStyle,
});
