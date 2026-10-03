// ── Technology view: initiatives using one technology, with assessment criteria and manual priority ──

// Global priority order: assessment.rank ascending, unranked last, stable on original order.
function compareRank(a, b) {
  const ra = a.assessment?.rank ?? Infinity;
  const rb = b.assessment?.rank ?? Infinity;
  if (ra === rb) return 0;
  return ra < rb ? -1 : 1;
}

// Sort by a 1–5 score (value | ttv); unscored go last, ties fall back to priority order.
function sortByScore(list, key, dir) {
  const score = (i) => i.assessment?.[key]?.score ?? null;
  return [...list].sort((a, b) => {
    const va = score(a), vb = score(b);
    if (va === null && vb === null) return compareRank(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return (dir === 'desc' ? vb - va : va - vb) || compareRank(a, b);
  });
}

function UiScoreEditor({ score, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = score != null && n <= score;
        return (
          <button key={n} type="button" aria-label={`Score ${n}`} onClick={() => onChange(score === n ? null : n)} style={{
            width: 13, height: 13, borderRadius: 99, padding: 0, cursor: 'pointer',
            border: `1px solid ${on ? UI.ink : UI.border}`, background: on ? UI.ink : UI.panel,
          }} />
        );
      })}
    </div>
  );
}

function UiNoteEditor({ text, onSave }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text || '');
  const cancelled = React.useRef(false);

  if (editing) {
    return (
      <textarea autoFocus value={draft} rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!cancelled.current && draft !== (text || '')) onSave(draft);
          cancelled.current = false;
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
        }}
        style={{
          width: 220, boxSizing: 'border-box', resize: 'vertical', padding: '5px 7px',
          fontFamily: UI.sans, fontSize: 11.5, lineHeight: 1.4, color: UI.ink,
          border: `1px solid ${UI.border}`, borderRadius: 5, background: '#fff',
        }} />
    );
  }

  return (
    <div role="button" tabIndex={0} title={text || 'Klik for at tilføje'}
      onClick={() => { setDraft(text || ''); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { setDraft(text || ''); setEditing(true); } }}
      style={{
        maxWidth: 220, minHeight: 18, cursor: 'text', fontSize: 11.5, color: UI.inkMuted, lineHeight: 1.4,
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
      {text || <span style={{ color: UI.inkFaint }}>+ Tilføj</span>}
    </div>
  );
}

function UiTechInitiativesView({ store, onOpenInit, onRankOrder, onUpdateAssess }) {
  const techs = store.technologies || [];
  const defaultTech = techs.find((t) => t.name?.trim() === 'Claude') || techs[0];
  const [techId, setTechId]   = React.useState(defaultTech?.id || null);
  const [sortKey, setSortKey] = React.useState('rank');
  const [sortDir, setSortDir] = React.useState('desc');

  if (!store) return null;

  const allOrdered = [...(store.initiatives || [])].sort(compareRank);
  const inTech     = allOrdered.filter((i) => (i.techIds || []).includes(techId));
  const canReorder = sortKey === 'rank';
  const visible    = canReorder ? inTech : sortByScore(inTech, sortKey, sortDir);

  const moveRank = (id, dir) => {
    const pos = inTech.findIndex((i) => i.id === id);
    const neighbour = inTech[pos + dir];
    if (pos < 0 || !neighbour) return;
    const ids = allOrdered.map((i) => i.id);
    const a = ids.indexOf(id), b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    onRankOrder(ids);
  };

  const clickSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const th = (label, key, extra = {}) => (
    <th onClick={key ? () => clickSort(key) : undefined} style={{
      padding: '8px 10px', textAlign: 'left', fontFamily: UI.mono, fontSize: 10, fontWeight: 700,
      letterSpacing: 0.6, textTransform: 'uppercase', color: sortKey === key ? UI.ink : UI.inkFaint,
      borderBottom: `1px solid ${UI.border}`, whiteSpace: 'nowrap',
      cursor: key ? 'pointer' : 'default', userSelect: 'none', ...extra,
    }}>
      {label}{key && sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
    </th>
  );

  const td = { padding: '9px 10px', borderBottom: `1px solid ${UI.border}`, verticalAlign: 'top', fontSize: 12, color: UI.ink };

  const arrowBtn = (label, disabled, onClick) => (
    <button onClick={onClick} disabled={disabled} style={{
      border: `1px solid ${UI.border}`, background: UI.panel, color: disabled ? UI.inkFaint : UI.inkMuted,
      borderRadius: 4, width: 22, height: 20, fontSize: 10, lineHeight: 1, padding: 0,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
    }}>{label}</button>
  );

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 20, fontFamily: UI.sans, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={techId || ''} onChange={(e) => setTechId(e.target.value)} style={{ ...uiInputStyle, width: 'auto', minWidth: 180 }}>
          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ fontFamily: UI.mono, fontSize: 11, color: UI.inkFaint }}>{inTech.length} initiativer</div>
        <div style={{ fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>
          {canReorder
            ? 'Rækkefølgen er prioriteten — ↑↓ flytter initiativet.'
            : 'Sorteret efter score — ↑↓ er kun aktive i prioritets-rækkefølgen.'}
        </div>
        <div style={{ fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>Klik i vurderings-kolonnerne for at redigere.</div>
      </div>

      {inTech.length === 0 ? (
        <div style={{ color: UI.inkFaint, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Ingen initiativer bruger denne teknologi endnu.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${UI.border}`, borderRadius: 8, background: UI.panel }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                {th('Prio', 'rank', { width: 60 })}
                {th('', null, { width: 56 })}
                {th('Initiativ', null)}
                {th('Status', null)}
                {th('Ejer', null)}
                {th('01 Værdi', 'value')}
                {th('02 Ejerskab', null)}
                {th('03 Strategi', null)}
                {th('04 Gov.', null)}
                {th('05 TTV', 'ttv')}
              </tr>
            </thead>
            <tbody>
              {visible.map((i, idx) => {
                const bu = (store.businessUnits || []).find((b) => b.id === i.buId);
                const a = i.assessment || {};
                const pos = inTech.indexOf(i);
                const update = (key, sub) => onUpdateAssess(i.id, key, sub);
                return (
                  <tr key={i.id}>
                    <td style={{ ...td, fontFamily: UI.mono, fontWeight: 700, color: UI.inkMuted }}>
                      {canReorder ? pos + 1 : idx + 1}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {arrowBtn('▲', !canReorder || pos === 0, () => moveRank(i.id, -1))}
                        {arrowBtn('▼', !canReorder || pos === inTech.length - 1, () => moveRank(i.id, 1))}
                      </div>
                    </td>
                    <td style={td}>
                      <button onClick={() => onOpenInit && onOpenInit(i)} style={{
                        border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left',
                        fontFamily: UI.sans, fontSize: 12.5, fontWeight: 600, color: UI.ink,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {bu && <UiBuDot bu={bu} />}
                        {i.name}
                      </button>
                    </td>
                    <td style={td}><UiStatusPill status={i.status} statuses={store.statuses} size="sm" /></td>
                    <td style={{ ...td, color: UI.inkMuted, whiteSpace: 'nowrap' }}>{i.owner || '–'}</td>
                    <td style={td}><UiScoreEditor score={a.value?.score ?? null} onChange={(v) => update('value', { score: v })} /></td>
                    <td style={td}><UiNoteEditor text={a.ownership?.note} onSave={(v) => update('ownership', { note: v })} /></td>
                    <td style={td}><UiNoteEditor text={a.strategy?.note} onSave={(v) => update('strategy', { note: v })} /></td>
                    <td style={td}>
                      <button type="button" title={a.readiness?.ready ? 'Governance-klar' : 'Klik for at markere governance-klar'}
                        onClick={() => update('readiness', { ready: !a.readiness?.ready })} style={{
                          border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                          fontSize: 13, fontWeight: 700, color: a.readiness?.ready ? 'oklch(0.48 0.13 155)' : UI.inkFaint,
                        }}>{a.readiness?.ready ? '✓' : '–'}</button>
                    </td>
                    <td style={td}><UiScoreEditor score={a.ttv?.score ?? null} onChange={(v) => update('ttv', { score: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { UiTechInitiativesView });
