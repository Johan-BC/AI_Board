// ── Ideas / "Boblere" view ────────────────────────────────────────────────────

function UiIdeasView({ store, onOpenInit }) {
  const [hoveredTech, setHoveredTech]       = React.useState(null);
  const [hoveredOutcome, setHoveredOutcome] = React.useState(null);

  if (!store) return null;

  const ideas      = (store.initiatives   || []).filter(i => i.status === 'idea');
  const techById   = _byId(store.technologies  || []);
  const outcomeById = _byId(store.outcomes     || []);
  const buById     = _byId(store.businessUnits || []);

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

  // Filter cards if a trend item is hovered
  const visibleIdeas = hoveredTech
    ? ideas.filter(i => (i.techIds    || []).includes(hoveredTech))
    : hoveredOutcome
    ? ideas.filter(i => (i.outcomeIds || []).includes(hoveredOutcome))
    : ideas;

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

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', fontFamily: UI.sans }}>

      {/* ── Trend sidebar ─────────────────────────────────────────────────────── */}
      <div style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${UI.border}`, overflowY: 'auto', background: UI.panelSoft, padding: '16px 14px' }}>

        <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14, fontFamily: UI.mono }}>
          {ideas.length} idéer
        </div>

        {techTrends.length > 0 && (<>
          <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, fontFamily: UI.mono }}>
            Teknologi-trends
          </div>
          {techTrends.map(t => (
            <div key={t.id}
              onMouseEnter={() => setHoveredTech(t.id)}
              onMouseLeave={() => setHoveredTech(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'default',
                opacity: hoveredTech && hoveredTech !== t.id ? 0.4 : 1, transition: 'opacity .12s' }}>
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
          ))}
          <div style={{ height: 1, background: UI.border, margin: '14px 0' }} />
        </>)}

        {outcomeTrends.length > 0 && (<>
          <div style={{ fontSize: 10, fontWeight: 700, color: UI.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, fontFamily: UI.mono }}>
            Outcome-trends
          </div>
          {outcomeTrends.map(o => (
            <div key={o.id}
              onMouseEnter={() => setHoveredOutcome(o.id)}
              onMouseLeave={() => setHoveredOutcome(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'default',
                opacity: hoveredOutcome && hoveredOutcome !== o.id ? 0.4 : 1, transition: 'opacity .12s' }}>
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
          ))}
        </>)}

        {(hoveredTech || hoveredOutcome) && (
          <div style={{ marginTop: 14, fontSize: 11, color: UI.inkFaint, fontStyle: 'italic' }}>
            Viser {visibleIdeas.length} af {ideas.length}
          </div>
        )}
      </div>

      {/* ── Card grid ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignContent: 'flex-start' }}>
          {visibleIdeas.map(i => {
            const bu       = buById[i.buId];
            const techs    = (i.techIds    || []).map(t => techById[t]).filter(Boolean);
            const outcomes = (i.outcomeIds || []).map(o => outcomeById[o]).filter(Boolean);
            const highlighted = hoveredTech
              ? (i.techIds || []).includes(hoveredTech)
              : hoveredOutcome
              ? (i.outcomeIds || []).includes(hoveredOutcome)
              : false;

            return (
              <div key={i.id}
                onClick={() => onOpenInit && onOpenInit(i)}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,16,12,.13)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = highlighted
                    ? '0 0 0 2px oklch(0.55 0.13 250)'
                    : '0 1px 4px rgba(20,16,12,.06)';
                  e.currentTarget.style.transform = '';
                }}
                style={{
                  width: 272, display: 'flex', flexDirection: 'column', gap: 10,
                  background: UI.panel, borderRadius: 14, padding: '16px 18px',
                  cursor: 'pointer', userSelect: 'none',
                  border: highlighted ? `1.5px solid ${UI.accent}` : `1px solid ${UI.border}`,
                  boxShadow: highlighted
                    ? `0 0 0 2px oklch(0.55 0.13 250 / 0.15)`
                    : '0 1px 4px rgba(20,16,12,.06)',
                  transition: 'box-shadow .15s, transform .15s, border-color .15s',
                }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {bu
                    ? <span style={{ fontSize: 9, fontWeight: 700, fontFamily: UI.mono, color: bu.accent, letterSpacing: 0.6, textTransform: 'uppercase' }}>{bu.short}</span>
                    : <span />}
                  <span style={{ fontSize: 9, fontWeight: 600, fontFamily: UI.mono, color: UI.inkFaint, background: UI.panelSoft, border: `1px solid ${UI.border}`, borderRadius: 99, padding: '2px 7px', letterSpacing: 0.4 }}>
                    💡 Idé
                  </span>
                </div>

                {/* Title */}
                <div style={{ fontSize: 14, fontWeight: 700, color: UI.ink, lineHeight: 1.35, letterSpacing: -0.2 }}>
                  {i.name}
                </div>

                {/* Description */}
                {i.description && (
                  <div style={{ fontSize: 12, color: UI.inkMuted, lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {i.description}
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
                        outline: hoveredTech === t.id ? `2px solid oklch(0.55 0.13 ${t.colorHue})` : 'none',
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
                        outline: hoveredOutcome === o.id ? `2px solid oklch(0.52 0.12 ${o.colorHue})` : 'none',
                      }}>{o.name}</span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                {(i.owner || (i.blockerIds || []).length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${UI.border}`, marginTop: 'auto' }}>
                    {i.owner
                      ? <span style={{ fontSize: 11, color: UI.inkFaint }}>{i.owner}</span>
                      : <span />}
                    {(i.blockerIds || []).length > 0 && (
                      <span style={{ fontSize: 10, color: '#b45309', fontWeight: 600 }}>
                        ⚠ {i.blockerIds.length} blocker{i.blockerIds.length > 1 ? 'e' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { UiIdeasView });
