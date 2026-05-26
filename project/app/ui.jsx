// Shared chrome: tokens, primitive controls, status pill, CRUD drawer.
// All three variations import these so the visual language is consistent
// across the canvas. Names are prefixed `Ui*` to dodge global collisions.

const UI = {
  bg:        'oklch(0.985 0.004 80)',
  panel:     '#ffffff',
  panelSoft: 'oklch(0.975 0.005 80)',
  border:    'oklch(0.93 0.006 80)',
  borderStrong: 'oklch(0.86 0.008 80)',
  ink:       'oklch(0.22 0.008 80)',
  inkMuted:  'oklch(0.48 0.006 80)',
  inkFaint:  'oklch(0.65 0.006 80)',
  accent:    'oklch(0.55 0.13 250)',
  shadow:    '0 1px 2px rgba(20,16,12,.04), 0 1px 0 rgba(20,16,12,.02)',
  shadowMd:  '0 2px 6px rgba(20,16,12,.05), 0 12px 32px rgba(20,16,12,.06)',
  sans:      "'Geist', 'Söhne', ui-sans-serif, system-ui, sans-serif",
  mono:      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

// Section/page chrome the three views all share at the top of their artboard.
function UiTopBar({ title, subtitle, right, kicker }) {
  return (
    <div style={{
      padding: '20px 28px 16px',
      borderBottom: `1px solid ${UI.border}`,
      display: 'flex', alignItems: 'flex-end', gap: 18,
      background: UI.panel,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && (
          <div style={{
            fontFamily: UI.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
            color: UI.inkFaint, marginBottom: 6,
          }}>{kicker}</div>
        )}
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5, color: UI.ink }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 13, color: UI.inkMuted, marginTop: 4 }}>{subtitle}</div>
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
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: UI.sans, fontWeight: 500, fontSize: size === 'sm' ? 10 : 11,
      letterSpacing: 0.2, color: s.color,
      padding: size === 'sm' ? '2px 7px 2px 6px' : '3px 9px 3px 8px',
      borderRadius: 99,
      background: `color-mix(in oklch, ${s.color} 8%, transparent)`,
      border: `1px solid color-mix(in oklch, ${s.color} 24%, transparent)`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: 99,
        background: s.color, boxShadow: isLive ? `0 0 0 3px color-mix(in oklch, ${s.color} 20%, transparent)` : 'none',
      }} />
      {s.label}
    </span>
  );
}

function UiTechChip({ tech, dim, hot, onClick, size = 'md' }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: UI.mono, fontSize: size === 'sm' ? 10 : 11, lineHeight: 1,
        padding: size === 'sm' ? '3px 7px' : '4px 9px',
        borderRadius: 4, cursor: 'pointer',
        background: hot ? UI.ink : (dim ? 'transparent' : UI.panelSoft),
        color: hot ? '#fff' : (dim ? UI.inkFaint : UI.ink),
        border: `1px solid ${hot ? UI.ink : UI.border}`,
        opacity: dim ? 0.4 : 1,
        transition: 'background .12s, color .12s, opacity .12s',
        fontWeight: 500,
      }}>
      <span style={{
        width: 4, height: 4, borderRadius: 99,
        background: hot ? '#fff' : UI.inkFaint, opacity: hot ? 0.9 : 0.7,
      }} />
      {tech.name}
    </button>
  );
}

function UiCategoryDot({ category }) {
  // Stable hue per category — lets matrix/legend show grouping at a glance.
  const hues = { 'Speech': 30, 'Agent tooling': 250, 'Assistant': 150,
    'LLM': 250, 'Vector DB': 290, 'Framework': 200, 'Image gen': 0, 'ML model': 150, 'Data': 80, 'Observability': 320 };
  const h = hues[category] ?? 250;
  return <span title={category} style={{
    width: 7, height: 7, borderRadius: 99, display: 'inline-block',
    background: `oklch(0.62 0.12 ${h})`,
  }} />;
}

function UiPlatformDot({ platform, size = 8 }) {
  return <span style={{
    width: size, height: size, borderRadius: 99, display: 'inline-block',
    background: platform.accent, flex: '0 0 auto',
  }} />;
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

// Side drawer that slides in from the right — used for edit/create in
// every view. Pass `mode` of 'edit'|'create', and onSave/onDelete handlers.
function UiInitiativeDrawer({ store, draft, onClose, onSave, onDelete }) {
  const [d, setD] = React.useState(draft);
  React.useEffect(() => setD(draft), [draft?.id, draft?._new]);
  if (!d) return null;
  const platform = store.platforms.find((p) => p.id === d.platformId) || store.platforms[0];
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
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${UI.border}` }}>
        <UiPlatformDot platform={platform} />
        <div style={{ flex: 1, fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint }}>
          {d._new ? 'New initiative' : 'Edit initiative'}
        </div>
        <button onClick={onClose} style={{
          border: 'none', background: 'transparent', color: UI.inkMuted,
          cursor: 'pointer', width: 24, height: 24, borderRadius: 4, fontSize: 18, lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <UiFieldRow label="Name">
          <input value={d.name} onChange={(e) => patch('name', e.target.value)} style={uiInputStyle} />
        </UiFieldRow>

        <UiFieldRow label="Platform">
          <UiSegmented value={d.platformId} options={store.platforms.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => patch('platformId', v)} />
        </UiFieldRow>

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
            style={{ ...uiInputStyle, height: 70, resize: 'none', lineHeight: 1.45 }} />
        </UiFieldRow>

        <UiFieldRow label="Tags" hint="comma-separated">
          <input value={d.tags.join(', ')} onChange={(e) => patch('tags', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} style={uiInputStyle} />
        </UiFieldRow>

        <UiFieldRow label="Technologies" hint={`${d.techIds.length} selected`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {techCats.map((cat) => (
              <div key={cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <UiCategoryDot category={cat} />
                  <div style={{ fontFamily: UI.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: UI.inkFaint }}>{cat}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {store.technologies.filter((t) => t.category === cat).map((t) => (
                    <UiTechChip key={t.id} tech={t} hot={d.techIds.includes(t.id)} onClick={() => toggleTech(t.id)} size="sm" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </UiFieldRow>
      </div>

      <div style={{
        padding: '12px 20px', borderTop: `1px solid ${UI.border}`,
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

// Global one-time styles + Google Fonts import.
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
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  UI, UiTopBar, UiButton, UiStatusPill, UiTechChip, UiToggle,
  UiCategoryDot, UiPlatformDot, UiInitiativeDrawer, UiFieldRow,
  UiSegmented, uiInputStyle,
});
