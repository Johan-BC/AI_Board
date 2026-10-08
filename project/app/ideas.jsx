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
  const all = store.initiatives || [];
  const max = Math.max(1, ...statuses.map((s) => all.filter((i) => i.status === s.id).length));
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap' }}>
      {statuses.map((s, k) => {
        const n = all.filter((i) => i.status === s.id).length;
        const here = s.id === 'idea';
        return (
          <React.Fragment key={s.id}>
            {k > 0 && <div style={{ alignSelf: 'center', color: UI.inkFaint, fontSize: 14 }}>→</div>}
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

function UiIdeasView({ store, onOpenInit, onUpdateAssess, onUpdateInit }) {
  const [selectedTechIds, setSelectedTechIds]       = React.useState([]);
  const [selectedOutcomeIds, setSelectedOutcomeIds] = React.useState([]);
  const [sortBy, setSortByRaw]   = React.useState(() => ideaPref('aiboard:ideas-sort', 'score', Object.keys(IDEA_SORTS)));
  const [groupBy, setGroupByRaw] = React.useState(() => ideaPref('aiboard:ideas-group', 'tier', ['tier', 'bu', 'none']));
  const setSortBy  = (v) => { setSortByRaw(v);  ideaSavePref('aiboard:ideas-sort', v); };
  const setGroupBy = (v) => { setGroupByRaw(v); ideaSavePref('aiboard:ideas-group', v); };

  const toggleTech    = id => setSelectedTechIds(ids    => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const toggleOutcome = id => setSelectedOutcomeIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const clearFilters  = () => { setSelectedTechIds([]); setSelectedOutcomeIds([]); };

  if (!store) return null;

  const ideas      = (store.initiatives   || []).filter(i => i.status === 'idea');
  const techById   = _byId(store.technologies  || []);
  const outcomeById = _byId(store.outcomes     || []);
  const buById     = _byId(store.businessUnits || []);

  // The status an idea is promoted to: the one after 'idea' in the store's order.
  const statusList = (store.statuses && store.statuses.length) ? store.statuses : STATUSES;
  const nextStatus = statusList[statusList.findIndex((s) => s.id === 'idea') + 1] || resolveStatus('poc', store.statuses);

  const promote = (i) => {
    if (!onUpdateInit) return;
    if (!window.confirm(`Løft "${i.name}" til ${nextStatus.label}?\n\nDen forsvinder fra Idéer og kommer på Gantt-boardet.`)) return;
    const patch = { status: nextStatus.id };
    if (!i.start) patch.start = dateToISO(new Date());   // the Gantt needs a start date
    onUpdateInit(i.id, patch);
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
    return techOk && outcomeOk;
  });
  const hasFilter = selectedTechIds.length > 0 || selectedOutcomeIds.length > 0;
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
  if (ideas.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: UI.inkFaint, fontFamily: UI.sans }}>
        <div style={{ fontSize: 40 }}>💡</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: UI.ink }}>Ingen idéer endnu</div>
        <div style={{ fontSize: 13 }}>Opret et initiativ med status "Idea" for at se det her</div>
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
      <div key={i.id}
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
          width: 272, display: 'flex', flexDirection: 'column', gap: 10,
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
        {(i.owner || (i.blockerIds || []).length > 0 || (isCandidate && onUpdateInit)) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, borderTop: `1px solid ${UI.border}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              {i.owner && <span style={{ fontSize: 11, color: UI.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.owner}</span>}
              {(i.blockerIds || []).length > 0 && (
                <span style={{ fontSize: 10, color: '#b45309', fontWeight: 600 }}>
                  ⚠ {i.blockerIds.length} blocker{i.blockerIds.length > 1 ? 'e' : ''}
                </span>
              )}
            </div>
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', fontFamily: UI.sans }}>

      {/* ── Trend sidebar ─────────────────────────────────────────────────────── */}
      <div style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${UI.border}`, overflowY: 'auto', background: UI.panelSoft, padding: '16px 14px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 1, textTransform: 'uppercase', fontFamily: UI.mono }}>
            {ideas.length} idéer
          </div>
          {hasFilter && (
            <div onClick={clearFilters}
              style={{ fontSize: 10, fontWeight: 700, color: UI.accent, cursor: 'pointer', letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: UI.mono }}>
              Ryd
            </div>
          )}
        </div>

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

        {hasFilter && (
          <div style={{ marginTop: 14, fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>
            Viser {visibleIdeas.length} af {ideas.length}
          </div>
        )}
      </div>

      {/* ── Main area: pipeline, controls, grouped cards ─────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

        <UiIdeaPipeline store={store} candidateCount={candidateCount} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: UI.mono }}>Sortér</span>
            <div style={{ width: 380, maxWidth: '100%' }}>
              <UiSegmented value={sortBy} onChange={setSortBy}
                options={Object.entries(IDEA_SORTS).map(([value, s]) => ({ value, label: s.label }))} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: UI.mono }}>Gruppér</span>
            <div style={{ width: 300, maxWidth: '100%' }}>
              <UiSegmented value={groupBy} onChange={setGroupBy} options={[
                { value: 'tier', label: 'Vurdering' }, { value: 'bu', label: 'Forretningsenhed' }, { value: 'none', label: 'Ingen' },
              ]} />
            </div>
          </div>
        </div>

        {visibleIdeas.length === 0 && (
          <div style={{ fontSize: 13, color: UI.inkFaint, fontStyle: 'italic' }}>Ingen idéer matcher filtrene.</div>
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
      </div>
    </div>
  );
}

Object.assign(window, { UiIdeasView });
