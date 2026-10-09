// ── Ideas / "Boblere" view ────────────────────────────────────────────────────

// ── Quick assessment helpers ────────────────────────────────────────────────
// An idea is a "kandidat" (ready to become an initiative) when both scores are
// set, together reach 7 of 10, and value is at least 3. Scores come from the
// same `assessment` object the drawer and the technology view edit.
const IDEA_CANDIDATE_MIN = 7;

function ideaScores(i) {
  const a = i.assessment || {};
  return { value: a.value?.score ?? null, ttv: a.ttv?.score ?? null, ready: !!a.readiness?.ready };
}

// 'candidate' | 'assessed' | 'unassessed'
function ideaTier(i) {
  const { value, ttv } = ideaScores(i);
  if (value == null && ttv == null) return 'unassessed';
  if (value != null && ttv != null && value >= 3 && value + ttv >= IDEA_CANDIDATE_MIN) return 'candidate';
  return 'assessed';
}

// Sort key for "Kandidat-score": value + ttv, half a point for governance-klar,
// a quarter point off per blocker. Unscored ideas sort last.
function ideaRankScore(i) {
  const { value, ttv, ready } = ideaScores(i);
  if (value == null && ttv == null) return -Infinity;
  return (value || 0) + (ttv || 0) + (ready ? 0.5 : 0) - 0.25 * (i.blockerIds || []).length;
}

const IDEA_TIERS = [
  { id: 'candidate',  label: 'Kandidater til initiativ', hint: `Værdi + TTV ≥ ${IDEA_CANDIDATE_MIN}` },
  { id: 'assessed',   label: 'Vurderet',                 hint: 'Har mindst én score' },
  { id: 'unassessed', label: 'Ikke vurderet',            hint: 'Giv værdi og TTV en score på kortet' },
];

const IDEA_SORTS = {
  score: { label: 'Kandidat-score', cmp: (a, b) => ideaRankScore(b) - ideaRankScore(a) },
  value: { label: 'Værdi', cmp: (a, b) => (ideaScores(b).value ?? -1) - (ideaScores(a).value ?? -1) },
  ttv:   { label: 'TTV',   cmp: (a, b) => (ideaScores(b).ttv ?? -1) - (ideaScores(a).ttv ?? -1) },
  name:  { label: 'Navn',  cmp: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'da') },
};

// View preference only (never part of the store); storage may be unavailable.
function ideaPref(key, fallback, allowed) {
  try { const v = localStorage.getItem(key); return allowed.includes(v) ? v : fallback; } catch (_) { return fallback; }
}
function ideaSavePref(key, v) { try { localStorage.setItem(key, v); } catch (_) {} }

// 1–5 score dots. Clicking the current score clears it. Read-only without onChange.
function UiIdeaScoreDots({ score, onChange, hue = 250 }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = score != null && n <= score;
        return (
          <button key={n} type="button" aria-label={`Score ${n}`} disabled={!onChange}
            title={onChange ? (score === n ? 'Fjern score' : `Sæt score ${n}`) : undefined}
            onClick={(e) => { e.stopPropagation(); onChange && onChange(score === n ? null : n); }}
            style={{
              width: 12, height: 12, borderRadius: 99, padding: 0,
              cursor: onChange ? 'pointer' : 'default',
              border: `1.5px solid ${on ? `oklch(0.55 0.13 ${hue})` : UI.borderStrong}`,
              background: on ? `oklch(0.55 0.13 ${hue})` : 'transparent',
            }} />
        );
      })}
    </div>
  );
}

// Idé → POC → Pilot → Prod, counted over the whole store.
function UiIdeaPipeline({ store, candidateCount }) {
  const statuses = (store.statuses && store.statuses.length) ? store.statuses : STATUSES;
  // Rejected ideas aren't part of the funnel.
  const all = (store.initiatives || []).filter((i) => !(i.status === 'idea' && i.rejected));
  const max = Math.max(1, ...statuses.map((s) => all.filter((i) => i.status === s.id).length));
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap' }}>
      {statuses.map((s, k) => {
        const n = all.filter((i) => i.status === s.id).length;
        const here = s.id === 'idea';
        return (
          <React.Fragment key={s.id}>
            {k > 0 && <div className="idea-pipe-arrow" style={{ alignSelf: 'center', color: UI.inkFaint, fontSize: 14 }}>→</div>}
            <div title={here ? 'Vises her' : `${n} initiativer i ${s.label} (på Gantt-boardet)`} style={{
              flex: '1 1 110px', minWidth: 100, padding: '9px 12px', borderRadius: 8,
              background: here ? UI.panel : UI.panelSoft,
              border: `1px solid ${here ? UI.borderStrong : UI.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: UI.inkMuted }}>{s.label}</span>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: UI.border, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(n / max) * 100}%`, height: '100%', background: s.color }} />
              </div>
              {here && (
                <div style={{ fontSize: 10.5, color: candidateCount ? UI.accent : UI.inkFaint, marginTop: 5, fontWeight: 600 }}>
                  {candidateCount ? `★ ${candidateCount} klar${candidateCount === 1 ? '' : 'e'} til næste trin` : 'Ingen kandidater endnu'}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Inline "+ Ny idé" form: name, business unit and an optional purpose. The rest
// is filled in from the drawer later. The chosen BU is remembered per browser.
function UiIdeaQuickCreate({ store, onCreate, onStart }) {
  const bus = store.businessUnits || [];
  const [open, setOpen]       = React.useState(false);
  const [name, setName]       = React.useState('');
  const [purpose, setPurpose] = React.useState('');
  const [buId, setBuIdRaw]    = React.useState(() => ideaPref('aiboard:ideas-new-bu', bus[0]?.id || '', bus.map((b) => b.id)));
  const setBuId = (v) => { setBuIdRaw(v); ideaSavePref('aiboard:ideas-new-bu', v); };
  const nameRef = React.useRef(null);
  React.useEffect(() => { if (open && nameRef.current) nameRef.current.focus(); }, [open]);

  const close = () => { setOpen(false); setName(''); setPurpose(''); };
  const submit = (e) => {
    e && e.preventDefault();
    if (!name.trim()) { nameRef.current && nameRef.current.focus(); return; }
    if (onCreate({ name: name.trim(), purpose: purpose.trim(), buId: buId || bus[0]?.id || '' })) {
      // Stay open for the next idea
      setName(''); setPurpose('');
      nameRef.current && nameRef.current.focus();
    }
  };

  if (!open) {
    return (
      <UiButton variant="primary" size="sm" onClick={() => { if (!onStart || onStart()) setOpen(true); }} title="Opret en idé direkte her"
        icon={<span style={{ fontSize: 13, lineHeight: 0 }}>+</span>}>Ny idé</UiButton>
    );
  }
  const field = { ...uiInputStyle, fontSize: 12.5, padding: '6px 9px' };
  return (
    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, background: UI.panel, border: `1px solid ${UI.borderStrong}`, boxShadow: UI.shadow, width: '100%' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: UI.mono }}>Ny idé</span>
      <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn på idéen"
        aria-label="Navn på idéen" style={{ ...field, flex: '2 1 160px', width: 'auto' }} />
      <select value={buId} onChange={(e) => setBuId(e.target.value)} aria-label="Forretningsenhed"
        style={{ ...field, flex: '0 1 170px', width: 'auto' }}>
        {bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Formål (valgfrit)"
        aria-label="Formål" style={{ ...field, flex: '3 1 160px', width: 'auto' }} />
      <button type="submit" disabled={!name.trim()} style={{
        fontFamily: UI.sans, fontSize: 12, fontWeight: 600, color: '#fff', background: name.trim() ? UI.ink : UI.borderStrong,
        border: 'none', borderRadius: 6, padding: '7px 12px', cursor: name.trim() ? 'pointer' : 'default',
      }}>Opret</button>
      {/* Plain button: UiButton has no type and would submit the form */}
      <button type="button" onClick={close} title="Luk (Esc)" aria-label="Luk" style={{
        fontFamily: UI.sans, fontSize: 13, fontWeight: 500, color: UI.inkMuted, background: 'transparent',
        border: 'none', borderRadius: 6, padding: '6px 6px', cursor: 'pointer',
      }}>✕</button>
    </form>
  );
}

// canEdit === false (view only): the edit buttons stay visible, but ask the
// user to connect (onRequestEdit) before any confirm/prompt dialog is shown.
function UiIdeasView({ store, onOpenInit, onUpdateAssess, onUpdateInit, onCreateInit, canEdit, onRequestEdit }) {
  const [selectedTechIds, setSelectedTechIds]       = React.useState([]);
  const [trendsOpen, setTrendsOpen]                 = React.useState(false);   // narrow screens only
  const [selectedOutcomeIds, setSelectedOutcomeIds] = React.useState([]);
  const [query, setQuery]               = React.useState('');
  const [showRejected, setShowRejected] = React.useState(false);
  const [sortBy, setSortByRaw]   = React.useState(() => ideaPref('aiboard:ideas-sort', 'score', Object.keys(IDEA_SORTS)));
  const [groupBy, setGroupByRaw] = React.useState(() => ideaPref('aiboard:ideas-group', 'tier', ['tier', 'bu', 'none']));
  const setSortBy  = (v) => { setSortByRaw(v);  ideaSavePref('aiboard:ideas-sort', v); };
  const setGroupBy = (v) => { setGroupByRaw(v); ideaSavePref('aiboard:ideas-group', v); };

  const toggleTech    = id => setSelectedTechIds(ids    => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const toggleOutcome = id => setSelectedOutcomeIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const clearFilters  = () => { setSelectedTechIds([]); setSelectedOutcomeIds([]); };

  if (!store) return null;

  // Rejected ideas keep status 'idea' but carry `rejected: { at, reason }`.
  // They are left out of trends, pipeline and cards, and listed at the bottom.
  const allIdeas   = (store.initiatives   || []).filter(i => i.status === 'idea');
  const ideas      = allIdeas.filter(i => !i.rejected);
  const rejected   = allIdeas.filter(i => i.rejected);
  const techById   = _byId(store.technologies  || []);
  const outcomeById = _byId(store.outcomes     || []);
  const buById     = _byId(store.businessUnits || []);

  // Free-text search over the card's text, owner, BU and technology names.
  const q = query.trim().toLocaleLowerCase('da');
  const matchesQuery = (i) => !q || [
    i.name, i.purpose, i.need, i.solution, i.owner, buById[i.buId]?.name,
    ...(i.techIds || []).map(t => techById[t]?.name),
  ].some(s => s && String(s).toLocaleLowerCase('da').includes(q));

  // The status an idea is promoted to: the one after 'idea' in the store's order.
  const statusList = (store.statuses && store.statuses.length) ? store.statuses : STATUSES;
  const nextStatus = statusList[statusList.findIndex((s) => s.id === 'idea') + 1] || resolveStatus('poc', store.statuses);

  const mayEdit = () => {
    if (canEdit !== false) return true;
    onRequestEdit && onRequestEdit();
    return false;
  };

  const promote = (i) => {
    if (!onUpdateInit || !mayEdit()) return;
    const isISO = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
    const fmt = (d) => d.split('-').reverse().join('.');
    const patch = { status: nextStatus.id };
    const start = isISO(i.start) ? i.start : dateToISO(new Date());
    if (start !== i.start) patch.start = start;          // the Gantt needs a start date
    // An end date before the start would draw a negative bar; give it the same
    // 120-day default as a new initiative. No end date (BAU) is left alone.
    if (isISO(i.end) && i.end < start) patch.end = dateToISO(addDays(parseISO(start), 120));
    const notes = [
      patch.start && `Startdato sættes til i dag (${fmt(patch.start)}).`,
      patch.end && `Slutdatoen ${fmt(i.end)} ligger før start og flyttes til ${fmt(patch.end)}.`,
    ].filter(Boolean);
    if (!window.confirm(`Løft "${i.name}" til ${nextStatus.label}?\n\nDen forsvinder fra Idéer og kommer på Gantt-boardet.${notes.length ? '\n\n' + notes.join('\n') : ''}`)) return;
    onUpdateInit(i.id, patch);
  };

  const reject = (i) => {
    if (!onUpdateInit || !mayEdit()) return;
    const reason = window.prompt(`Afvis "${i.name}"?\n\nSkriv evt. en begrundelse. Idéen kan genåbnes senere.`, '');
    if (reason === null) return;
    onUpdateInit(i.id, { rejected: { at: dateToISO(new Date()), reason: reason.trim() } });
  };
  const reopen = (i) => onUpdateInit && mayEdit() && onUpdateInit(i.id, { rejected: undefined });

  // ── Quick create ─────────────────────────────────────────────────────────────
  const create = (draft) => {
    if (!onCreateInit) return false;
    const today = new Date();
    const ok = onCreateInit({
      id: 'i_' + Math.random().toString(36).slice(2, 7),
      buId: draft.buId, platformIds: [], departmentIds: [],
      name: draft.name, status: 'idea', owner: draft.owner || '',
      techIds: [], blockerIds: [], outcomeIds: [], tags: [],
      purpose: draft.purpose || '', need: '', solution: '',
      start: dateToISO(today), end: dateToISO(addDays(today, 120)),   // same defaults as "+ Ny"
      milestones: [],
    });
    if (ok === false) return false;   // view-only: the board asks the user to connect
    // Make sure the new idea is visible
    clearFilters(); setQuery('');
    return true;
  };

  // ── Trend counts ─────────────────────────────────────────────────────────────
  const techCounts = {}, outcomeCounts = {};
  ideas.forEach(i => {
    (i.techIds    || []).forEach(t => { techCounts[t]    = (techCounts[t]    || 0) + 1; });
    (i.outcomeIds || []).forEach(o => { outcomeCounts[o] = (outcomeCounts[o] || 0) + 1; });
  });

  const techTrends = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ ...(techById[id] || {}), id, count }))
    .filter(t => t.name);

  const outcomeTrends = Object.entries(outcomeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ ...(outcomeById[id] || {}), id, count }))
    .filter(o => o.name);

  const maxCount = Math.max(1, ...techTrends.map(t => t.count), ...outcomeTrends.map(o => o.count));

  // Filter cards by selected trend items: any match within a group, AND across groups
  const visibleIdeas = ideas.filter(i => {
    const techOk    = selectedTechIds.length    === 0 || (i.techIds    || []).some(t => selectedTechIds.includes(t));
    const outcomeOk = selectedOutcomeIds.length === 0 || (i.outcomeIds || []).some(o => selectedOutcomeIds.includes(o));
    return techOk && outcomeOk && matchesQuery(i);
  });
  const hasFilter = selectedTechIds.length > 0 || selectedOutcomeIds.length > 0;
  const isNarrowed = hasFilter || !!q;
  const candidateCount = ideas.filter((i) => ideaTier(i) === 'candidate').length;

  // ── Sort + group ─────────────────────────────────────────────────────────────
  // Ties fall back to name, so the order is stable between renders.
  const sorted = [...visibleIdeas].sort((a, b) => IDEA_SORTS[sortBy].cmp(a, b) || IDEA_SORTS.name.cmp(a, b));
  const groups = groupBy === 'tier'
    ? IDEA_TIERS.map((t) => ({ key: t.id, label: t.label, hint: t.hint, items: sorted.filter((i) => ideaTier(i) === t.id) }))
    : groupBy === 'bu'
      ? [
          ...(store.businessUnits || []).map((bu) => ({ key: bu.id, label: bu.name, dot: bu.accent, items: sorted.filter((i) => i.buId === bu.id) })),
          { key: '_none', label: 'Uden forretningsenhed', items: sorted.filter((i) => !buById[i.buId]) },
        ]
      : [{ key: 'all', label: null, items: sorted }];

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (allIdeas.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: UI.inkFaint, fontFamily: UI.sans, padding: 24 }}>
        <div style={{ fontSize: 40 }}>💡</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: UI.ink }}>Ingen idéer endnu</div>
        <div style={{ fontSize: 13 }}>Opret den første her, eller et initiativ med status "Idea"</div>
        {onCreateInit && <div style={{ marginTop: 6, width: 'min(720px, 100%)', display: 'flex', justifyContent: 'center' }}><UiIdeaQuickCreate store={store} onCreate={create} onStart={mayEdit} /></div>}
      </div>
    );
  }

  const renderCard = (i) => {
    const bu       = buById[i.buId];
    const techs    = (i.techIds    || []).map(t => techById[t]).filter(Boolean);
    const outcomes = (i.outcomeIds || []).map(o => outcomeById[o]).filter(Boolean);
    const { value, ttv, ready } = ideaScores(i);
    const isCandidate = ideaTier(i) === 'candidate';
    const highlighted = hasFilter && (
      (i.techIds    || []).some(t => selectedTechIds.includes(t)) ||
      (i.outcomeIds || []).some(o => selectedOutcomeIds.includes(o))
    );
    const baseShadow = highlighted ? `0 0 0 2px oklch(0.55 0.13 250 / 0.15)` : '0 1px 4px rgba(20,16,12,.06)';
    const assess = onUpdateAssess ? (key, sub) => onUpdateAssess(i.id, key, sub) : null;

    return (
      <div key={i.id} className="idea-card"
        onClick={() => onOpenInit && onOpenInit(i)}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,16,12,.13)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = baseShadow;
          e.currentTarget.style.transform = '';
        }}
        style={{
          width: 272, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 10,
          background: UI.panel, borderRadius: 14, padding: '16px 18px',
          cursor: 'pointer', userSelect: 'none',
          border: highlighted ? `1.5px solid ${UI.accent}` : isCandidate ? `1.5px solid oklch(0.80 0.08 250)` : `1px solid ${UI.border}`,
          boxShadow: baseShadow,
          transition: 'box-shadow .15s, transform .15s, border-color .15s',
        }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {bu
            ? <span style={{ fontSize: 9, fontWeight: 700, fontFamily: UI.mono, color: bu.accent, letterSpacing: 0.6, textTransform: 'uppercase' }}>{bu.short}</span>
            : <span />}
          {isCandidate
            ? <span title={`Værdi + TTV ≥ ${IDEA_CANDIDATE_MIN}`} style={{ fontSize: 9, fontWeight: 700, fontFamily: UI.mono, color: UI.accent, background: 'oklch(0.96 0.03 250)', border: '1px solid oklch(0.85 0.06 250)', borderRadius: 99, padding: '2px 7px', letterSpacing: 0.4 }}>
                ★ Kandidat
              </span>
            : <span style={{ fontSize: 9, fontWeight: 600, fontFamily: UI.mono, color: UI.inkFaint, background: UI.panelSoft, border: `1px solid ${UI.border}`, borderRadius: 99, padding: '2px 7px', letterSpacing: 0.4 }}>
                💡 Idé
              </span>}
        </div>

        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 700, color: UI.ink, lineHeight: 1.35, letterSpacing: -0.2 }}>
          {i.name}
        </div>

        {/* Formål / Behov / Løsning */}
        {(i.purpose || i.need || i.solution) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['Formål', i.purpose], ['Behov', i.need], ['Løsning', i.solution]].map(([label, text]) => text && (
              <div key={label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: UI.mono, marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, color: UI.inkMuted, lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tech tags */}
        {techs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {techs.map(t => (
              <span key={t.id} style={{
                fontSize: 10, fontFamily: UI.mono, fontWeight: 600,
                color: `oklch(0.38 0.10 ${t.colorHue})`,
                background: `oklch(0.97 0.022 ${t.colorHue})`,
                border: `1px solid oklch(0.88 0.06 ${t.colorHue})`,
                borderRadius: 4, padding: '2px 6px',
                outline: selectedTechIds.includes(t.id) ? `2px solid oklch(0.55 0.13 ${t.colorHue})` : 'none',
              }}>{t.name}</span>
            ))}
          </div>
        )}

        {/* Outcomes */}
        {outcomes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {outcomes.map(o => (
              <span key={o.id} style={{
                fontSize: 10, color: UI.inkMuted,
                background: UI.panelSoft, border: `1px solid ${UI.border}`,
                borderRadius: 4, padding: '2px 6px',
                outline: selectedOutcomeIds.includes(o.id) ? `2px solid oklch(0.52 0.12 ${o.colorHue})` : 'none',
              }}>{o.name}</span>
            ))}
          </div>
        )}

        {/* Quick assessment — clicks here must not open the drawer */}
        <div onClick={(e) => e.stopPropagation()}
          style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: 10, rowGap: 5, padding: '8px 10px', borderRadius: 8, background: UI.panelSoft, cursor: 'default', marginTop: 'auto' }}>
          <span title="01 Værdipotentiale — gevinst + rækkevidde" style={{ fontSize: 9, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: UI.mono }}>Værdi</span>
          <UiIdeaScoreDots score={value} hue={250} onChange={assess && ((v) => assess('value', { score: v }))} />
          <span title="05 Time-to-value + skalerbarhed" style={{ fontSize: 9, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: UI.mono }}>TTV</span>
          <UiIdeaScoreDots score={ttv} hue={155} onChange={assess && ((v) => assess('ttv', { score: v }))} />
          <span style={{ fontSize: 9, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: UI.mono }}>Klar</span>
          <label title="04 Data/tech/governance er på plads" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: ready ? 'oklch(0.45 0.12 150)' : UI.inkMuted, cursor: assess ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={ready} disabled={!assess}
              onChange={(e) => assess && assess('readiness', { ready: e.target.checked })}
              style={{ margin: 0, accentColor: 'oklch(0.52 0.13 150)' }} />
            Governance-klar
          </label>
        </div>

        {/* Footer */}
        {(i.owner || (i.blockerIds || []).length > 0 || onUpdateInit) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, borderTop: `1px solid ${UI.border}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
              {i.owner && <span style={{ fontSize: 11, color: UI.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.owner}</span>}
              {(i.blockerIds || []).length > 0 && (
                <span style={{ fontSize: 10, color: '#b45309', fontWeight: 600 }}>
                  ⚠ {i.blockerIds.length} blocker{i.blockerIds.length > 1 ? 'e' : ''}
                </span>
              )}
            </div>
            {onUpdateInit && (
              <button type="button" onClick={(e) => { e.stopPropagation(); reject(i); }}
                title="Afvis idéen — den flyttes til Afviste idéer og kan genåbnes"
                style={{ flex: '0 0 auto', fontFamily: UI.sans, fontSize: 11, fontWeight: 500, color: UI.inkMuted, background: 'transparent', border: `1px solid ${UI.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                Afvis
              </button>
            )}
            {isCandidate && onUpdateInit && (
              <button type="button" onClick={(e) => { e.stopPropagation(); promote(i); }}
                title={`Skift status til ${nextStatus.label}`}
                style={{ flex: '0 0 auto', fontFamily: UI.sans, fontSize: 11, fontWeight: 600, color: '#fff', background: UI.ink, border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
                Løft til {nextStatus.label} →
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="idea-root" style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', fontFamily: UI.sans }}>

      {/* ── Trend sidebar ─────────────────────────────────────────────────────── */}
      <div className="idea-side" style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${UI.border}`, overflowY: 'auto', background: UI.panelSoft, padding: '16px 14px' }}>

        <div className="idea-side-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 1, textTransform: 'uppercase', fontFamily: UI.mono }}>
            {ideas.length} idéer
          </div>
          <div style={{ flex: 1 }} />
          {hasFilter && (
            <div onClick={clearFilters}
              style={{ fontSize: 10, fontWeight: 700, color: UI.accent, cursor: 'pointer', letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: UI.mono }}>
              Ryd
            </div>
          )}
          {/* Shown on narrow screens only, where the trends fold away above the cards */}
          {(techTrends.length > 0 || outcomeTrends.length > 0) && (
            <button type="button" className="idea-side-toggle" onClick={() => setTrendsOpen((v) => !v)} aria-expanded={trendsOpen}
              style={{ display: 'none', fontFamily: UI.sans, fontSize: 11, fontWeight: 600, color: UI.ink, background: UI.panel, border: `1px solid ${UI.border}`, borderRadius: 6, padding: '4px 9px', cursor: 'pointer' }}>
              {trendsOpen ? 'Skjul trends ▴' : `Trends${hasFilter ? ` (${selectedTechIds.length + selectedOutcomeIds.length})` : ''} ▾`}
            </button>
          )}
        </div>

        <div className="idea-side-body" data-open={trendsOpen ? 'true' : 'false'}>

        {techTrends.length > 0 && (<>
          <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, fontFamily: UI.mono }}>
            Teknologi-trends
          </div>
          {techTrends.map(t => {
            const active = selectedTechIds.includes(t.id);
            return (
              <div key={t.id}
                onClick={() => toggleTech(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', padding: '2px 4px', margin: '0 -4px 8px', borderRadius: 6,
                  opacity: selectedTechIds.length > 0 && !active ? 0.4 : 1,
                  background: active ? `oklch(0.96 0.03 ${t.colorHue || 250})` : 'transparent',
                  transition: 'opacity .12s, background .12s' }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${active ? `oklch(0.55 0.13 ${t.colorHue || 250})` : UI.border}`,
                  background: active ? `oklch(0.55 0.13 ${t.colorHue || 250})` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: UI.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
                    {t.name}
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: UI.border, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${(t.count / maxCount) * 100}%`,
                      background: `oklch(0.55 0.13 ${t.colorHue || 250})`,
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: UI.inkMuted, fontFamily: UI.mono, minWidth: 14, textAlign: 'right' }}>{t.count}</span>
              </div>
            );
          })}
          <div style={{ height: 1, background: UI.border, margin: '14px 0' }} />
        </>)}

        {outcomeTrends.length > 0 && (<>
          <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, fontFamily: UI.mono }}>
            Outcome-trends
          </div>
          {outcomeTrends.map(o => {
            const active = selectedOutcomeIds.includes(o.id);
            return (
              <div key={o.id}
                onClick={() => toggleOutcome(o.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', padding: '2px 4px', margin: '0 -4px 8px', borderRadius: 6,
                  opacity: selectedOutcomeIds.length > 0 && !active ? 0.4 : 1,
                  background: active ? `oklch(0.96 0.03 ${o.colorHue || 155})` : 'transparent',
                  transition: 'opacity .12s, background .12s' }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${active ? `oklch(0.52 0.12 ${o.colorHue || 155})` : UI.border}`,
                  background: active ? `oklch(0.52 0.12 ${o.colorHue || 155})` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: UI.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
                    {o.name}
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: UI.border, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${(o.count / maxCount) * 100}%`,
                      background: `oklch(0.52 0.12 ${o.colorHue || 155})`,
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: UI.inkMuted, fontFamily: UI.mono, minWidth: 14, textAlign: 'right' }}>{o.count}</span>
              </div>
            );
          })}
        </>)}

        </div>

        {isNarrowed && (
          <div style={{ marginTop: 14, fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>
            Viser {visibleIdeas.length} af {ideas.length}
          </div>
        )}
      </div>

      {/* ── Main area: pipeline, controls, grouped cards ─────────────────────── */}
      <div className="idea-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

        <UiIdeaPipeline store={store} candidateCount={candidateCount} />

        {/* Search + quick create */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 420 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: UI.inkFaint, pointerEvents: 'none' }}>⌕</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
              placeholder="Søg i navn, formål, ejer, teknologi…" aria-label="Søg i idéer"
              style={{ ...uiInputStyle, fontSize: 12.5, padding: '6px 9px 6px 26px' }} />
          </div>
          {q && <span style={{ fontSize: 11.5, color: UI.inkMuted }}>{visibleIdeas.length} af {ideas.length} idéer</span>}
          {onCreateInit && <UiIdeaQuickCreate store={store} onCreate={create} onStart={mayEdit} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: UI.mono, width: 50, flex: '0 0 auto' }}>Sortér</span>
            <div style={{ width: 380, minWidth: 0, flex: '0 1 auto' }}>
              <UiSegmented value={sortBy} onChange={setSortBy}
                options={Object.entries(IDEA_SORTS).map(([value, s]) => ({ value, label: s.label }))} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: UI.mono, width: 50, flex: '0 0 auto' }}>Gruppér</span>
            <div style={{ width: 300, minWidth: 0, flex: '0 1 auto' }}>
              <UiSegmented value={groupBy} onChange={setGroupBy} options={[
                { value: 'tier', label: 'Vurdering' }, { value: 'bu', label: 'Forretningsenhed' }, { value: 'none', label: 'Ingen' },
              ]} />
            </div>
          </div>
        </div>

        {visibleIdeas.length === 0 && (
          <div style={{ fontSize: 13, color: UI.inkFaint, fontStyle: 'italic' }}>
            {ideas.length === 0 ? 'Alle idéer er afvist.' : q ? `Ingen idéer matcher "${query.trim()}".` : 'Ingen idéer matcher filtrene.'}
          </div>
        )}

        {groups.filter((g) => g.items.length > 0).map((g) => (
          <div key={g.key}>
            {g.label && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                {g.dot && <span style={{ width: 8, height: 8, borderRadius: 99, background: g.dot, alignSelf: 'center' }} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: g.key === 'candidate' ? UI.accent : UI.ink }}>
                  {g.key === 'candidate' ? '★ ' : ''}{g.label}
                </span>
                <span style={{ fontSize: 11, fontFamily: UI.mono, color: UI.inkMuted }}>{g.items.length}</span>
                {g.hint && <span style={{ fontSize: 11, color: UI.inkFaint }}>· {g.hint}</span>}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
              {g.items.map(renderCard)}
            </div>
          </div>
        ))}

        {/* ── Rejected ideas: folded away, can be reopened ── */}
        {rejected.length > 0 && (
          <div style={{ borderTop: `1px solid ${UI.border}`, paddingTop: 14 }}>
            <button type="button" onClick={() => setShowRejected((v) => !v)} aria-expanded={showRejected}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: UI.sans }}>
              <span style={{ fontSize: 10, color: UI.inkFaint, display: 'inline-block', transform: showRejected ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▶</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: UI.inkMuted }}>Afviste idéer</span>
              <span style={{ fontSize: 11, fontFamily: UI.mono, color: UI.inkFaint }}>{rejected.length}</span>
            </button>
            {showRejected && (
              <div style={{ marginTop: 10, background: UI.panel, border: `1px solid ${UI.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {[...rejected].sort(IDEA_SORTS.name.cmp).map((i) => {
                  const bu = buById[i.buId];
                  const r = i.rejected || {};
                  const at = /^\d{4}-\d{2}-\d{2}$/.test(r.at || '') ? r.at.split('-').reverse().join('.') : '';
                  return (
                    <div key={i.id} onClick={() => onOpenInit && onOpenInit(i)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: `1px solid ${UI.border}`, cursor: onOpenInit ? 'pointer' : 'default' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = UI.panelSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      {bu && <span style={{ fontSize: 9, fontWeight: 700, fontFamily: UI.mono, color: bu.accent, letterSpacing: 0.6, textTransform: 'uppercase', width: 28 }}>{bu.short}</span>}
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: UI.inkMuted, textDecoration: 'line-through', textDecorationColor: UI.borderStrong }}>{i.name}</div>
                        <div style={{ fontSize: 11, color: UI.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {at ? `Afvist ${at}` : 'Afvist'}{r.reason ? ` · ${r.reason}` : ''}
                        </div>
                      </div>
                      {onUpdateInit && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); reopen(i); }} title="Flyt idéen tilbage blandt de aktive idéer"
                          style={{ flex: '0 0 auto', fontFamily: UI.sans, fontSize: 11, fontWeight: 500, color: UI.ink, background: UI.panel, border: `1px solid ${UI.borderStrong}`, borderRadius: 6, padding: '4px 9px', cursor: 'pointer' }}>
                          Genåbn
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Narrow screens: the trend sidebar folds away above the cards, and the whole
// view scrolls as one column.
if (typeof document !== 'undefined' && !document.getElementById('idea-styles')) {
  const st = document.createElement('style');
  st.id = 'idea-styles';
  st.textContent = `
    @media (max-width: 720px) {
      .idea-root { flex-direction: column !important; overflow-x: hidden !important; overflow-y: auto !important; }
      .idea-root > .idea-side { width: auto !important; border-right: none !important; border-bottom: 1px solid ${UI.border}; overflow: visible !important; padding: 10px 12px !important; }
      .idea-root .idea-side-head { margin-bottom: 0 !important; }
      .idea-root .idea-side-toggle { display: inline-block !important; }
      .idea-root .idea-side-body[data-open="true"] { margin-top: 12px; }
      .idea-root .idea-side-body[data-open="false"] { display: none; }
      .idea-root > .idea-main { flex: 0 0 auto !important; overflow: visible !important; padding: 14px 12px 24px !important; }
      .idea-root .idea-card { width: 100% !important; }
      .idea-root .idea-pipe-arrow { display: none; }
    }
  `;
  document.head.appendChild(st);
}

Object.assign(window, { UiIdeasView });
