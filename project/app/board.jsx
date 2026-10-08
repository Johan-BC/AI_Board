// AI Initiative Board — BU swim lanes, full-width Gantt.
// Technologies + Blockers live in a compact horizontal strip above the Gantt.

// ── Date helpers ──────────────────────────────────────────────────────────────
const D_MS = 86400000;
function parseISO(s) { const [y, m, d] = String(s || '').split('-').map(Number); return new Date(y, m - 1, d); }
// Danish month names, spelled out here rather than via toLocaleString so the
// board reads the same in every browser locale.
const DA_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function fmtMon(d) { return DA_MONTHS[d.getMonth()]; }
function fmtDay(d) { return `${d.getDate()}. ${DA_MONTHS[d.getMonth()]}`; }
function fmtDate(d) { return `${fmtDay(d)} ${d.getFullYear()}`; }
// A 'YYYY-MM-DD' string that parses to a real local date (BAU '' / null → false).
function isValidISO(s) { return !!s && !isNaN(parseISO(s)); }
// Whole calendar days from a to b; rounding absorbs the 23/25 h DST days.
function daysBetween(a, b) { return Math.round((b - a) / D_MS); }
// "3 mdr." / "1 år 2 mdr." — rough duration for tooltips.
function fmtDuration(days) {
  const months = Math.max(1, Math.round(days / 30.44));
  if (months < 12) return `${months} md${months === 1 ? '.' : 'r.'}`;
  const y = Math.floor(months / 12), m = months % 12;
  return m ? `${y} år ${m} md${m === 1 ? '.' : 'r.'}` : `${y} år`;
}
function fmtInDays(n) {
  if (n === 0) return 'i dag';
  if (n > 0)   return `om ${n} dag${n === 1 ? '' : 'e'}`;
  return `for ${-n} dag${n === -1 ? '' : 'e'} siden`;
}
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
const OUTCOME_TEAL   = 'oklch(0.48 0.13 175)';
const OVERDUE_AMBER  = 'oklch(0.55 0.14 60)';

// ── Persistence ───────────────────────────────────────────────────────────────
// data.json on GitHub is the only store. The browser keeps just the PAT and
// view preferences — never a copy of the board, so no edit can end up saved
// in one browser only. GitHub helpers + merge live in sync.jsx.
const PAT_KEY       = 'aiboard:github-pat';      // token (from a link or pasted)
const MODE_KEY      = 'aiboard:access-mode';     // 'view' | 'edit'
const NAME_KEY      = 'aiboard:editor-name';     // shown in commit messages
const COLLAPSE_KEY  = 'aiboard:collapsed-bus';
const SYNC_CFG      = resolveSyncConfig();
const SAVE_DEBOUNCE = 3000;

// ── Loading screen ────────────────────────────────────────────────────────────
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

// ── Shared modal shell ────────────────────────────────────────────────────────
function Modal({ children, width = 440 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(20,16,12,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: UI.bg, borderRadius: 14, padding: '32px 36px', width, maxWidth: '90vw',
        boxShadow: '0 24px 64px rgba(20,16,12,.25)', fontFamily: UI.sans,
        border: `1px solid ${UI.border}`,
      }}>{children}</div>
    </div>
  );
}

const contactLine = () => SYNC_CFG.contact
  ? <>Kontakt <strong>{SYNC_CFG.contact}</strong>.</>
  : 'Kontakt den, der administrerer boardet.';

// ── No access (link mode without a working link) ─────────────────────────────
function NoAccessScreen({ kind }) {
  const text = {
    none:  'Boardet åbnes via det link, du har fået tilsendt. Klik på linket i mailen eller beskeden — så husker browseren det.',
    bad:   'Dit link virker ikke længere — det er udløbet eller udskiftet. Bed om et nyt link.',
    error: 'Boardet kunne ikke hentes lige nu. Tjek din forbindelse og prøv igen.',
  }[kind];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: UI.bg, fontFamily: UI.sans, padding: 16 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>AI Board</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: UI.ink, margin: '0 0 12px' }}>
          {kind === 'error' ? 'Kunne ikke hente boardet' : 'Du skal bruge dit link'}
        </h1>
        <p style={{ fontSize: 14, color: UI.inkMuted, lineHeight: 1.6, margin: '0 0 8px' }}>{text}</p>
        {kind !== 'error' && <p style={{ fontSize: 13, color: UI.inkFaint, lineHeight: 1.6, margin: 0 }}>{contactLine()}</p>}
        {kind === 'error' && (
          <button onClick={() => location.reload()} style={{
            marginTop: 12, padding: '8px 18px', borderRadius: 7, border: 'none',
            background: UI.ink, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: UI.sans,
          }}>Prøv igen</button>
        )}
      </div>
    </div>
  );
}

// ── Editor name prompt ────────────────────────────────────────────────────────
function NamePrompt({ initial, onSave, onCancel }) {
  const [val, setVal] = React.useState(initial || '');
  const ok = val.trim().length > 0;
  const save = () => ok && onSave(val.trim());
  return (
    <Modal width={400}>
      <div style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Redigering</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: UI.ink, margin: '0 0 10px' }}>Hvad hedder du?</h2>
      <p style={{ fontSize: 13, color: UI.inkMuted, lineHeight: 1.6, margin: '0 0 16px' }}>
        Dit navn gemmes sammen med dine ændringer, så man kan se hvem der har rettet hvad.
      </p>
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Fornavn Efternavn"
        style={{ width: '100%', padding: '9px 12px', borderRadius: 7, boxSizing: 'border-box', border: `1.5px solid ${UI.border}`, fontFamily: UI.sans, fontSize: 14, color: UI.ink, background: UI.panel, outline: 'none' }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        {onCancel && <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 7, border: `1px solid ${UI.border}`, background: 'transparent', color: UI.inkMuted, cursor: 'pointer', fontSize: 13, fontFamily: UI.sans }}>Annullér</button>}
        <button onClick={save} disabled={!ok} style={{
          padding: '8px 18px', borderRadius: 7, border: 'none', background: UI.ink, color: '#fff',
          cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.45, fontSize: 13, fontWeight: 600, fontFamily: UI.sans,
        }}>Gem</button>
      </div>
    </Modal>
  );
}

// ── PAT setup overlay ─────────────────────────────────────────────────────────
function PatSetupOverlay({ onConnect, onSkip }) {
  const [val, setVal]     = React.useState('');
  const [phase, setPhase] = React.useState('idle'); // idle | busy | err
  const [errMsg, setErrMsg] = React.useState('');
  // In link mode editors get access from their link — the token field is for the admin
  const [showToken, setShowToken] = React.useState(!SYNC_CFG.linkMode);

  const connect = async () => {
    const pat = val.trim();
    if (!pat || !SYNC_CFG.repo) return;
    setPhase('busy');
    try {
      const result = await readFromGitHub(SYNC_CFG, pat);
      localStorage.setItem(PAT_KEY, pat);
      onConnect(pat, result.store, result.sha);
    } catch (e) {
      setErrMsg(
        e.status === 401 ? 'Tokenet blev afvist — det er ugyldigt eller udløbet.' :
        e.status === 403 ? 'Adgang nægtet — tokenet mangler adgang, afventer godkendelse i organisationen, eller skal SSO-autoriseres.' :
        e.status === 404 ? `Fandt ikke ${SYNC_CFG.file} i ${SYNC_CFG.repo} — tjek at tokenet har adgang til netop dette repo.` :
        'Kunne ikke forbinde til GitHub.');
      setPhase('err');
    }
  };

  const code = (t) => (
    <code style={{ fontFamily: UI.mono, fontSize: 12, background: UI.panelSoft, padding: '1px 6px', borderRadius: 3, border: `1px solid ${UI.border}` }}>{t}</code>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(20,16,12,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: UI.bg, borderRadius: 14, padding: '32px 36px', width: 460, maxWidth: '90vw',
        boxShadow: '0 24px 64px rgba(20,16,12,.25)', fontFamily: UI.sans,
        border: `1px solid ${UI.border}`,
      }}>
        <div style={{ fontFamily: UI.mono, fontSize: 10, color: UI.inkFaint, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Redigering</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: UI.ink, margin: '0 0 10px' }}>
          {SYNC_CFG.linkMode ? 'Du kan kun se boardet' : 'Forbind til GitHub for at redigere'}
        </h2>
        {SYNC_CFG.linkMode && (
          <p style={{ fontSize: 13, color: UI.inkMuted, lineHeight: 1.65, margin: '0 0 12px' }}>
            Du har åbnet boardet med et visningslink. For at oprette og rette initiativer skal du bruge
            redigeringslinket. {contactLine()}
          </p>
        )}
        {SYNC_CFG.linkMode && !showToken && (
          <button onClick={() => setShowToken(true)} style={{ border: 'none', background: 'transparent', padding: 0, color: UI.inkFaint, fontSize: 11, fontFamily: UI.mono, cursor: 'pointer' }}>
            Har du et GitHub-token? ›
          </button>
        )}
        {!showToken ? null : !SYNC_CFG.repo ? (
          <p style={{ fontSize: 13, color: BLOCKER_RED, lineHeight: 1.65, margin: '0 0 8px' }}>
            Repo er ikke konfigureret. Sæt {code('repo')} i {code('config.js')} (fx {code('org/AI_Board')}).
          </p>
        ) : (<>
          <p style={{ fontSize: 13, color: UI.inkMuted, lineHeight: 1.65, margin: '0 0 12px' }}>
            {SYNC_CFG.linkMode ? 'Med et token' : 'Alle kan se boardet. For at oprette og redigere initiativer'} skal du have skriveadgang til{' '}
            <strong>{SYNC_CFG.repo}</strong> og et{' '}
            <a href={SYNC_CFG.tokenUrl} target="_blank" rel="noopener"
              style={{ color: UI.accent, textDecoration: 'none', borderBottom: `1px solid ${UI.accent}` }}>
              fine-grained token
            </a>:
          </p>
          <ul style={{ fontSize: 12.5, color: UI.inkMuted, lineHeight: 1.7, margin: '0 0 20px', paddingLeft: 18 }}>
            <li>Resource owner: ejeren af {code(SYNC_CFG.repo.split('/')[0])}</li>
            <li>Repository access: kun {code(SYNC_CFG.repo.split('/')[1])}</li>
            <li>Permissions → Contents: <em>Read and write</em></li>
          </ul>
          <input
            autoFocus
            type="password"
            value={val}
            onChange={(e) => { setVal(e.target.value); setPhase('idle'); }}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
            placeholder="github_pat_…"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 7, boxSizing: 'border-box',
              border: `1.5px solid ${phase === 'err' ? BLOCKER_RED : UI.border}`,
              fontFamily: UI.mono, fontSize: 13, color: UI.ink, background: UI.panel,
              outline: 'none', marginBottom: phase === 'err' ? 6 : 0,
            }}
          />
          {phase === 'err' && (
            <p style={{ fontSize: 12, color: BLOCKER_RED, margin: 0, lineHeight: 1.5 }}>{errMsg}</p>
          )}
          <p style={{ fontSize: 11, color: UI.inkFaint, lineHeight: 1.5, margin: '10px 0 0' }}>
            Tokenet gemmes kun i denne browser. Dine ændringer gemmes som commits i dit navn.
          </p>
        </>)}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onSkip} style={{
            padding: '8px 18px', borderRadius: 7, border: `1px solid ${UI.border}`,
            background: 'transparent', color: UI.inkMuted, cursor: 'pointer',
            fontSize: 13, fontFamily: UI.sans,
          }}>{SYNC_CFG.linkMode ? 'OK' : 'Kun se'}</button>
          {SYNC_CFG.repo && showToken && (
            <button onClick={connect} disabled={!val.trim() || phase === 'busy'} style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: UI.ink, color: '#fff',
              cursor: val.trim() && phase !== 'busy' ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600, fontFamily: UI.sans,
              opacity: val.trim() && phase !== 'busy' ? 1 : 0.45,
            }}>{phase === 'busy' ? 'Forbinder…' : 'Forbind'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter strip — multi-row, no scrollbar, no category labels ───────────────
function FilterStrip({
  store, selectedTechs, selectedBlockers, selectedOutcomes,
  toggleTech, toggleBlocker, toggleOutcome,
  techSynergy, blockerSynergy, outcomeSynergy,
  matchMode, setMatchMode,
  blockerMode, setBlockerMode,
  filteredInits, matchedSet, blockerMatchedSet, outcomeMatchedSet,
  onClearTechs, onClearBlockers, onClearOutcomes,
}) {
  const hasTech    = selectedTechs.size > 0;
  const hasBlocker = selectedBlockers.size > 0;
  const hasOutcome = selectedOutcomes.size > 0;
  const totalBlocked = store.initiatives.filter((i) => (i.blockerIds || []).length > 0).length;

  const makeChip = ({ id, name, selected, hue, isBlocker, onToggle, buSize, initCount }) => {
    const accentColor = isBlocker ? BLOCKER_RED : `oklch(0.5 0.15 ${hue})`;
    const accentGlow  = isBlocker ? BLOCKER_RED_BG : `oklch(0.5 0.15 ${hue} / 0.22)`;
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
        {initCount != null && (
          <span style={{
            fontSize: 9.5, fontFamily: UI.mono, fontWeight: 600, lineHeight: 1,
            padding: '1px 4px', borderRadius: 3,
            background: selected ? 'rgba(255,255,255,0.22)' : UI.panelSoft,
            color: selected ? '#fff' : UI.inkMuted,
            border: selected ? '1px solid rgba(255,255,255,0.18)' : `1px solid ${UI.border}`,
          }}>{initCount}</span>
        )}
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

  const usedTechIds    = new Set(store.initiatives.flatMap((i) => i.techIds    || []));
  const usedBlockerIds = new Set(store.initiatives.flatMap((i) => i.blockerIds || []));
  const usedOutcomeIds = new Set(store.initiatives.flatMap((i) => i.outcomeIds || []));

  const techInitCount    = new Map(store.technologies.map((t) => [t.id, store.initiatives.filter((i) => (i.techIds    || []).includes(t.id)).length]));
  const blockerInitCount = new Map((store.blockers || []).map((b) => [b.id, store.initiatives.filter((i) => (i.blockerIds || []).includes(b.id)).length]));
  const outcomeInitCount = new Map((store.outcomes  || []).map((o) => [o.id, store.initiatives.filter((i) => (i.outcomeIds || []).includes(o.id)).length]));

  const techChips = store.technologies.filter((t) => usedTechIds.has(t.id)).map((t) => makeChip({
    id: t.id, name: t.name, selected: selectedTechs.has(t.id),
    hue: techHue(t), isBlocker: false,
    onToggle: () => toggleTech(t.id),
    buSize: (techSynergy.get(t.id) || new Set()).size,
    initCount: techInitCount.get(t.id) ?? 0,
  }));

  const blockerChips = (store.blockers || []).filter((b) => usedBlockerIds.has(b.id)).map((b) => makeChip({
    id: b.id, name: b.name, selected: selectedBlockers.has(b.id),
    hue: 15, isBlocker: true,
    onToggle: () => toggleBlocker(b.id),
    buSize: (blockerSynergy.get(b.id) || new Set()).size,
    initCount: blockerInitCount.get(b.id) ?? 0,
  }));

  const outcomeChips = (store.outcomes || []).filter((o) => usedOutcomeIds.has(o.id)).map((o) => makeChip({
    id: o.id, name: o.name, selected: selectedOutcomes.has(o.id),
    hue: o.colorHue ?? 155, isBlocker: false,
    onToggle: () => toggleOutcome(o.id),
    buSize: (outcomeSynergy.get(o.id) || new Set()).size,
    initCount: outcomeInitCount.get(o.id) ?? 0,
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
      <div style={{ flex: 1, padding: '8px 12px', borderRight: `1px solid ${UI.border}` }}>
        <SectionHeader
          label="Teknologier" color={UI.accent}
          hasSelection={hasTech}
          matchCount={matchedSet.size} totalCount={filteredInits.length}
          matchMode={matchMode} setMatchMode={setMatchMode}
          showMatchToggle={selectedTechs.size > 1}
          onClear={onClearTechs}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{techChips}</div>
      </div>
      <div style={{ flex: 1, padding: '8px 12px', borderRight: `1px solid ${UI.border}` }}>
        <SectionHeader
          label="⚠ Blockers" color={BLOCKER_RED}
          hasSelection={hasBlocker}
          matchCount={blockerMatchedSet.size} totalCount={filteredInits.length}
          onClear={onClearBlockers}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{blockerChips}</div>
      </div>
      <div style={{ flex: 1, padding: '8px 12px', borderRight: `1px solid ${UI.border}` }}>
        <SectionHeader
          label="Outcomes" color={OUTCOME_TEAL}
          hasSelection={hasOutcome}
          matchCount={outcomeMatchedSet.size} totalCount={filteredInits.length}
          onClear={onClearOutcomes}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{outcomeChips}</div>
      </div>
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

// ── Initiative timing & lane summary ─────────────────────────────────────────
// Where an initiative stands relative to today — shared by the hover card and
// the per-lane summary so the two never disagree. Missing / BAU dates are null.
function initTiming(i, today) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const s = isValidISO(i.start) ? parseISO(i.start) : null;
  const e = isValidISO(i.end)   ? parseISO(i.end)   : null;
  const total = s && e ? daysBetween(s, e) : null;
  return {
    s, e, bau: !i.end,
    notStarted:  !!(s && s > t0),
    daysToStart: s ? daysBetween(t0, s) : null,
    daysLeft:    e ? daysBetween(t0, e) : null,
    // End date passed while the initiative isn't in production — worth a look.
    overdue:     !!(e && e < t0 && i.status !== 'prod'),
    pct: total > 0 ? Math.min(100, Math.max(0, Math.round(daysBetween(s, t0) / total * 100))) : null,
    duration: total,
  };
}

function upcomingMilestones(i, today, withinDays) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (i.milestones || [])
    .filter((m) => isValidISO(m.date))
    .map((m) => ({ ...m, d: parseISO(m.date) }))
    .filter((m) => m.d >= t0 && (withinDays == null || daysBetween(t0, m.d) <= withinDays))
    .sort((a, b) => a.d - b.d);
}

const MILESTONE_SOON_DAYS = 30;

// Counts for one lane: status mix, blocked, end date passed, milestones soon.
function laneSummary(items, statuses, today) {
  const list = (statuses && statuses.length ? statuses : STATUSES).filter((s) => s.id !== 'idea');
  const byStatus = list
    .map((s) => ({ status: s, n: items.filter((i) => i.status === s.id).length }))
    .filter((x) => x.n > 0);
  // Statuses not in the catalogue still count, so the numbers add up
  const known = new Set(list.map((s) => s.id));
  const other = items.filter((i) => !known.has(i.status)).length;
  if (other) byStatus.push({ status: { id: '_other', label: 'Andet', color: UI.inkFaint }, n: other });
  return {
    total:   items.length,
    byStatus,
    blocked: items.filter((i) => (i.blockerIds || []).length > 0).length,
    overdue: items.filter((i) => initTiming(i, today).overdue).length,
    soon:    items.reduce((n, i) => n + upcomingMilestones(i, today, MILESTONE_SOON_DAYS).length, 0),
  };
}

function laneSummaryText(sum) {
  return [
    `${sum.total} initiativer`,
    ...sum.byStatus.map((x) => `${x.n} ${x.status.label}`),
    sum.blocked ? `${sum.blocked} blokeret` : null,
    sum.overdue ? `${sum.overdue} over slutdato` : null,
    sum.soon    ? `${sum.soon} milepæl${sum.soon === 1 ? '' : 'e'} inden for ${MILESTONE_SOON_DAYS} dage` : null,
  ].filter(Boolean).join(' · ');
}

// Compact chips for a lane's numbers. `sticky` = left offset (px) at which the
// row stays pinned while the timeline scrolls sideways.
function LaneSummaryChips({ sum, sticky }) {
  const chip = (key, content, color, title) => (
    <span key={key} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      fontFamily: UI.mono, fontSize: 9.5, fontWeight: 600, lineHeight: 1, color: color || UI.inkMuted,
      background: UI.panel, border: `1px solid ${color ? `color-mix(in oklch, ${color} 30%, transparent)` : UI.border}`,
      borderRadius: 4, padding: '3px 6px',
    }}>{content}</span>
  );
  return (
    <div style={{
      position: 'sticky', left: sticky, display: 'inline-flex', alignItems: 'center', gap: 5,
      pointerEvents: 'auto', paddingRight: 10,
    }}>
      {sum.byStatus.map((x) => chip(x.status.id, <>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: x.status.color }} />{x.n} {x.status.label}
      </>, null, `${x.n} i status ${x.status.label}`))}
      {sum.blocked > 0 && chip('blk', `⚠ ${sum.blocked} blokeret`, BLOCKER_RED, `${sum.blocked} initiativ${sum.blocked === 1 ? '' : 'er'} har mindst én blocker`)}
      {sum.overdue > 0 && chip('od', `⏱ ${sum.overdue} over slutdato`, OVERDUE_AMBER, 'Slutdatoen er passeret, men status er ikke Prod')}
      {sum.soon > 0 && chip('ms', `◆ ${sum.soon} milepæl${sum.soon === 1 ? '' : 'e'} ≤ ${MILESTONE_SOON_DAYS} d`, null, `Milepæle inden for de næste ${MILESTONE_SOON_DAYS} dage`)}
    </div>
  );
}

// ── Hover card for an initiative (bar or label row) ──────────────────────────
// Follows the mouse on its own (a document listener + direct style writes), so
// moving the pointer never re-renders the whole board.
function BarHoverCard({ tip, store, today, canEdit }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = (x, y) => {
      const w = el.offsetWidth, h = el.offsetHeight, gap = 14;
      let left = x + gap, top = y + gap;
      if (left + w > window.innerWidth - 8)  left = x - w - gap;
      if (top + h > window.innerHeight - 8)  top  = y - h - gap;
      el.style.left = `${Math.max(8, left)}px`;
      el.style.top  = `${Math.max(8, top)}px`;
    };
    place(tip.x, tip.y);
    const onMove = (ev) => place(ev.clientX, ev.clientY);
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [tip]);

  const i = tip.init;
  const status = resolveStatus(i.status, store.statuses);
  const t = initTiming(i, today);
  const names = (list, ids) => (ids || []).map((id) => (list || []).find((x) => x.id === id)).filter(Boolean).map((x) => x.name);
  const depts     = names(store.departments, i.departmentIds);
  const platforms = names(store.platforms, i.platformIds);
  const techs     = names(store.technologies, i.techIds);
  const blockers  = names(store.blockers, i.blockerIds);
  const outcomes  = names(store.outcomes, i.outcomeIds);
  const nextMs    = upcomingMilestones(i, today)[0];

  const period = t.s && t.e ? `${fmtDate(t.s)} – ${fmtDate(t.e)}`
               : t.s        ? `${fmtDate(t.s)} – løbende (BAU)`
               : t.e        ? `ingen start – ${fmtDate(t.e)}`
               :              'løbende, ingen datoer';
  let when = null, whenColor = 'rgba(255,255,255,0.75)';
  if (t.notStarted)                  when = `Starter ${fmtInDays(t.daysToStart)}`;
  else if (t.overdue)              { when = `Slutdato passeret ${fmtInDays(t.daysLeft)} — status er stadig ${status.label}`; whenColor = 'oklch(0.85 0.12 70)'; }
  else if (t.e && t.daysLeft < 0)    when = `Afsluttet ${fmtInDays(t.daysLeft)}`;
  else if (t.pct != null)            when = `${t.pct} % af perioden forløbet · slutter ${fmtInDays(t.daysLeft)}`;
  else if (t.bau && t.s)             when = 'Løbende drift — ingen slutdato';

  const row = (label, value, color) => value ? (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <span style={{ flex: '0 0 74px', color: 'rgba(255,255,255,0.5)', fontFamily: UI.mono, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.6, paddingTop: 1 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, color: color || '#fff' }}>{value}</span>
    </div>
  ) : null;

  return (
    <div ref={ref} role="tooltip" style={{
      position: 'fixed', left: -9999, top: -9999, zIndex: 9998, pointerEvents: 'none',
      width: 300, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
      background: UI.ink, color: '#fff', borderRadius: 8, padding: '10px 12px',
      fontFamily: UI.sans, fontSize: 11.5, lineHeight: 1.45,
      boxShadow: '0 8px 24px rgba(20,16,12,.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: status.color, flex: '0 0 auto' }} />
        <span style={{ fontWeight: 700, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name || 'Uden navn'}</span>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
        {[tip.bu && tip.bu.name, status.label, i.owner].filter(Boolean).join(' · ')}
      </div>
      {t.pct != null && !t.overdue && (
        <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.15)', marginTop: 7, overflow: 'hidden' }}>
          <div style={{ width: `${t.pct}%`, height: '100%', background: status.color }} />
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        {row('Periode', `${period}${t.duration > 0 ? ` (${fmtDuration(t.duration)})` : ''}`)}
        {row('Status', when, whenColor)}
        {row('Milepæl', nextMs ? `${nextMs.label || 'Milepæl'} · ${fmtDay(nextMs.d)} (${fmtInDays(daysBetween(new Date(today.getFullYear(), today.getMonth(), today.getDate()), nextMs.d))})` : null)}
        {row('Blockers', blockers.length ? `⚠ ${blockers.join(', ')}` : null, 'oklch(0.8 0.12 20)')}
        {row('Afdeling', depts.join(', '))}
        {row('Platform', platforms.join(', '))}
        {row('Teknologi', techs.join(', '))}
        {row('Outcomes', outcomes.join(', '))}
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', fontFamily: UI.mono, fontSize: 9.5 }}>
        {canEdit ? 'Klik for at åbne · træk for at flytte' : 'Klik for at åbne'}
      </div>
    </div>
  );
}

// ── Main board component ──────────────────────────────────────────────────────
function BoardView() {
  const [store, setStoreRaw]                      = React.useState(null);
  const [syncStatus, setSyncStatus]               = React.useState('loading');
  const [connected, setConnected]                 = React.useState(false);
  const [noAccess, setNoAccess]                   = React.useState(null); // null | 'none' | 'bad' | 'error'
  const [editorName, setEditorName]               = React.useState(() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } });
  const [askName, setAskName]                     = React.useState(false);
  const nameRef = React.useRef(editorName);
  nameRef.current = editorName;
  const [showPatSetup, setShowPatSetup]           = React.useState(false);
  const [statusFilter, setStatusFilter]           = React.useState(null);
  const [buFilter, setBuFilter]                   = React.useState(null);
  const [selectedTechs, setSelectedTechs]         = React.useState(() => new Set());
  const [selectedBlockers, setSelectedBlockers]   = React.useState(() => new Set());
  const [selectedOutcomes, setSelectedOutcomes]   = React.useState(() => new Set());
  const [matchMode, setMatchMode]                 = React.useState('any');
  const [drawer, setDrawer]                       = React.useState(null);
  const [zoom, setZoom]                           = React.useState(1);
  const [blockerMode, setBlockerMode]             = React.useState(false);
  const [catalogue, setCatalogue]                 = React.useState(false);
  const [view, setView]                           = React.useState('gantt'); // 'gantt' | 'portfolio' | 'import' | 'ideas' | 'tech'
  const [milestoneTooltip, setMilestoneTooltip]   = React.useState(null); // {label, date, x, y}
  const [hoverTip, setHoverTip]                   = React.useState(null); // {init, bu, x, y}
  const draggingRef                               = React.useRef(false);
  const [labelW, setLabelW]                       = React.useState(280);
  const labelWRef                                 = React.useRef(280);
  // Collapsed BU lanes — a view preference, kept out of the store so it never
  // travels to data.json / GitHub.
  const [collapsedBUs, setCollapsedBUs]           = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch (_) { return new Set(); }
  });

  // Sync state lives in a ref: async saves/polls must see the latest values.
  //   base = the store as last read from / written to GitHub (at `sha`)
  const syncRef = React.useRef({ pat: null, base: null, sha: null, timer: null, inflight: false, again: false });
  const storeRef     = React.useRef(null);   // latest store, readable from async code
  const connectedRef = React.useRef(false);
  storeRef.current = store;
  const dragSuppressRef = React.useRef(null);
  const scrollerRef     = React.useRef(null);

  // Every edit goes through here: without a GitHub connection the board is
  // view-only, so a change can never end up saved in one browser only.
  // Returns false when the edit was refused.
  const setStore = (updater) => {
    if (!connectedRef.current) { setShowPatSetup(true); return false; }
    setStoreRaw(updater);
    return true;
  };

  const applyStore = (s) => {
    setStoreRaw(s);
    setSelectedTechs(new Set()); setSelectedBlockers(new Set()); setSelectedOutcomes(new Set());
    setStatusFilter(null); setBuFilter(null); setDrawer(null);
    setBlockerMode(false);
  };

  // Published copy served next to index.html — what view-only visitors see.
  const loadStatic = () => {
    const tryFetch = ([url, ...rest]) => url
      ? fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
          .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
          .catch(() => tryFetch(rest))
      : Promise.reject(new Error('not found'));
    return tryFetch([`./${SYNC_CFG.file}`, `../${SYNC_CFG.file}`]).then(parseJSON).catch(() => makeStore());
  // (Not used in link mode: there data.json is private and only reachable with a token.)
  };

  const connectWith = (pat, s, sha) => {
    Object.assign(syncRef.current, { pat, base: s, sha });
    connectedRef.current = true;
    setConnected(true);
    setSyncStatus('idle');
  };

  const disconnect = () => {
    const sy = syncRef.current;
    clearTimeout(sy.timer);
    Object.assign(sy, { pat: null, base: null, sha: null, timer: null });
    connectedRef.current = false;
    setConnected(false);
    setSyncStatus('readonly');
  };

  // mode 'edit' → editable; 'view' → read through the API with a read-only token
  const loadFromGitHub = (pat, mode, initial) => {
    setSyncStatus('loading');
    readFromGitHub(SYNC_CFG, pat)
      .then(({ store: s, sha }) => {
        setNoAccess(null);
        applyStore(s);
        if (mode === 'edit') connectWith(pat, s, sha);
        else { Object.assign(syncRef.current, { pat, base: s, sha }); setSyncStatus('readonly'); }
      })
      .catch((err) => {
        const rejected = err.status === 401 || err.status === 403 || err.status === 404;
        if (SYNC_CFG.linkMode) {
          // No public copy to fall back to
          if (initial || !storeRef.current) { setNoAccess(rejected ? 'bad' : 'error'); return; }
        } else if (initial) {
          // Show the published copy, view-only, until GitHub answers
          loadStatic().then(applyStore);
        }
        setSyncStatus(rejected ? 'auth-error' : 'load-error');
      });
  };

  // ── Initial load ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const link = takeLinkToken();
    if (link) {
      try { localStorage.setItem(PAT_KEY, link.token); localStorage.setItem(MODE_KEY, link.mode); } catch (_) {}
    }
    const pat  = localStorage.getItem(PAT_KEY);
    const mode = localStorage.getItem(MODE_KEY) || 'edit'; // a pasted token is an editor's
    if (pat && SYNC_CFG.repo) { loadFromGitHub(pat, mode, true); return; }
    if (SYNC_CFG.linkMode) { setNoAccess('none'); return; }
    loadStatic().then((s) => { applyStore(s); setSyncStatus('readonly'); });
  }, []);

  // ── Save: commit to GitHub, merging if someone else saved in between ───────
  const markSaved = () => {
    setSyncStatus('saved');
    setTimeout(() => setSyncStatus((st) => st === 'saved' ? 'idle' : st), 2500);
  };

  const flush = async () => {
    const sy = syncRef.current;
    clearTimeout(sy.timer); sy.timer = null;
    if (sy.inflight) { sy.again = true; return; }
    const sent0 = storeRef.current;
    if (!connectedRef.current || !sent0 || deepEq(sent0, sy.base)) return;

    sy.inflight = true;
    setSyncStatus('saving');
    let sent = sent0;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          sy.sha = await writeToGitHub(SYNC_CFG, sy.pat, sent, sy.sha, describeChange(sy.base, sent, nameRef.current));
          sy.base = sent;
          break;
        } catch (err) {
          if (err.code !== 'conflict' || attempt >= 4) throw err;
          const remote = await readFromGitHub(SYNC_CFG, sy.pat);
          sent = merge3(sy.base, sent, remote.store);
          sy.base = remote.store; sy.sha = remote.sha;
        }
      }
      if (sent !== sent0) {
        // Others' changes were merged in — show them, keeping edits made meanwhile
        const next = merge3(sent0, storeRef.current, sent);
        storeRef.current = next;
        setStoreRaw(next);
      }
      markSaved();
    } catch (err) {
      sy.inflight = false; sy.again = false;
      // Edits stay in memory; "Prøv igen" re-runs flush()
      setSyncStatus(err.status === 401 || err.status === 403 ? 'auth-error' : 'error');
      return;
    }
    sy.inflight = false;
    if (sy.again || !deepEq(storeRef.current, sy.base)) {
      sy.again = false;
      sy.timer = setTimeout(flush, SAVE_DEBOUNCE);
      setSyncStatus('saving');
    }
  };

  React.useEffect(() => {
    const sy = syncRef.current;
    if (!store || !connectedRef.current || sy.inflight || deepEq(store, sy.base)) return;
    setSyncStatus('saving');
    clearTimeout(sy.timer);
    sy.timer = setTimeout(flush, SAVE_DEBOUNCE);
  }, [store]);

  // ── Pick up others' changes ─────────────────────────────────────────────────
  // Editors poll the API and merge; view-link holders re-read through the API;
  // anyone else re-reads the published copy.
  const refresh = async () => {
    const sy = syncRef.current;
    if (document.hidden) return;
    if (!connectedRef.current) {
      if (sy.pat) {
        try {
          const remote = await readFromGitHub(SYNC_CFG, sy.pat);
          if (connectedRef.current || remote.sha === sy.sha) return;
          sy.base = remote.store; sy.sha = remote.sha;
          setStoreRaw(remote.store);
        } catch (_) {}
        return;
      }
      if (SYNC_CFG.linkMode) return;
      const s = await loadStatic();
      if (!connectedRef.current && !deepEq(s, storeRef.current)) setStoreRaw(s);
      return;
    }
    if (sy.inflight || sy.timer) return; // a pending save merges on its own
    try {
      const remote = await readFromGitHub(SYNC_CFG, sy.pat);
      if (sy.inflight || remote.sha === sy.sha) return;
      const cur  = storeRef.current;
      const next = merge3(sy.base, cur, remote.store);
      sy.base = remote.store; sy.sha = remote.sha;
      if (!deepEq(next, cur)) { storeRef.current = next; setStoreRaw(next); }
    } catch (_) { /* transient — next tick retries */ }
  };

  React.useEffect(() => {
    if (syncStatus === 'loading') return;
    // API readers (editors + view links) poll often; the published copy changes slowly
    const id = setInterval(refresh, connected || syncRef.current.pat ? SYNC_CFG.pollMs : 60000);
    const onVisible = () => {
      if (document.hidden) { if (syncRef.current.timer) flush(); } // save before the tab is left
      else refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [connected, syncStatus === 'loading']);

  // Warn before closing the tab with unsaved edits
  React.useEffect(() => {
    const onBeforeUnload = (e) => {
      const sy = syncRef.current;
      if (sy.timer || sy.inflight || (connectedRef.current && storeRef.current && !deepEq(storeRef.current, sy.base))) {
        e.preventDefault(); e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // ── PAT connect callback (from overlay) ────────────────────────────────────
  const onPatConnect = (pat, ghStore, sha) => {
    try { localStorage.setItem(MODE_KEY, 'edit'); } catch (_) {}
    setShowPatSetup(false);
    setStoreRaw(ghStore); // keep the current view/filters
    connectWith(pat, ghStore, sha);
  };

  const today = new Date();

  // Ideas aren't registered initiatives yet: they stay out of the Gantt and
  // everything derived from it (filter chips, counts, synergies, time range).
  const ganttInits = React.useMemo(
    () => (store ? store.initiatives.filter((i) => i.status !== 'idea') : []),
    [store]);

  const filteredInits = React.useMemo(() => {
    if (!store) return [];
    return ganttInits.filter((i) =>
      (!statusFilter || i.status === statusFilter) &&
      (!buFilter     || i.buId === buFilter)
    );
  }, [store, ganttInits, statusFilter, buFilter]);

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

  const techSynergy    = React.useMemo(() => store ? buildSynergyMap(ganttInits, 'techIds')     : new Map(), [store, ganttInits]);
  const blockerSynergy = React.useMemo(() => store ? buildSynergyMap(ganttInits, 'blockerIds')  : new Map(), [store, ganttInits]);
  const outcomeSynergy = React.useMemo(() => store ? buildSynergyMap(ganttInits, 'outcomeIds')  : new Map(), [store, ganttInits]);

  const outcomeMatchedSet = React.useMemo(() => {
    if (!store || selectedOutcomes.size === 0) return new Set();
    return new Set(filteredInits.filter((i) =>
      (i.outcomeIds || []).some((o) => selectedOutcomes.has(o))
    ).map((i) => i.id));
  }, [filteredInits, selectedOutcomes]);

  const toggleTech    = (id) => setSelectedTechs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBlocker = (id) => setSelectedBlockers((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleOutcome = (id) => setSelectedOutcomes((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBUCollapse = (id) => setCollapsedBUs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  React.useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedBUs])); } catch (_) {}
  }, [collapsedBUs]);

  // Which set is currently driving the highlight, mirroring getBarStyle's
  // precedence — null when nothing is filtering. Used to tell the user how many
  // hits are hidden inside a collapsed lane.
  const highlightSet = React.useMemo(() => {
    if (selectedBlockers.size > 0) return blockerMatchedSet;
    if (selectedOutcomes.size > 0) return outcomeMatchedSet;
    if (selectedTechs.size    > 0) return matchedSet;
    return null;
  }, [selectedBlockers, selectedOutcomes, selectedTechs, blockerMatchedSet, outcomeMatchedSet, matchedSet]);

  const range = React.useMemo(() => {
    const fallback = { start: new Date(today.getFullYear(), today.getMonth() - 2, 1), end: new Date(today.getFullYear(), today.getMonth() + 10, 0) };
    if (!store) return fallback;
    const inits = ganttInits;
    // BAU (no end date) initiatives only contribute their start to range, not end.
    const starts = inits.map(i => parseISO(i.start)).filter(d => !isNaN(d));
    const ends   = inits.filter(i => i.end).map(i => parseISO(i.end)).filter(d => !isNaN(d));
    const dates  = [...starts, ...ends];
    if (!dates.length) return fallback;
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
  const timelineW = monthList.length * monthW;
  const dayPx     = timelineW / ((range.end - range.start) / D_MS + 1);
  const dateToX   = (d) => ((d - range.start) / D_MS) * dayPx;

  // Horizontal extent of an initiative's bar — the same rules the bar renderer
  // uses: no start → from the timeline's left edge, BAU → to its right edge.
  // (parseISO on a missing date gives an Invalid Date, i.e. NaN coordinates.)
  const barX = (i) => ({
    x1: isValidISO(i.start) ? dateToX(parseISO(i.start)) : 0,
    x2: isValidISO(i.end)   ? dateToX(parseISO(i.end))   : timelineW,
  });

  const BU_H = 40, DEPT_H = 34, PLAT_H = 28, ROW_H = 44, LANE_GAP = 8;

  const layout = React.useMemo(() => {
    if (!store) return { rows: [], totalH: 0 };
    const rows = []; let y = 0;
    const visibleBUs = store.businessUnits.filter((b) => !buFilter || b.id === buFilter);
    const allPlatforms = store.platforms || [];
    const allDepts = store.departments || [];

    for (const bu of visibleBUs) {
      const items = filteredInits.filter((i) => i.buId === bu.id);
      const collapsed = collapsedBUs.has(bu.id);
      rows.push({ kind: 'bu', bu, y, h: BU_H, count: items.length, collapsed, items });
      y += BU_H;

      // A collapsed lane keeps only its header row — every downstream memo
      // (bands, spans, connectors, bars) reads layout.rows, so hiding the rows
      // here is enough to hide the whole lane.
      if (collapsed) { y += LANE_GAP; continue; }

      // Helper: is this init "owned" by exactly one dept (goes under dept header)?
      const hasSingleDept = (i) => (i.departmentIds || []).length === 1;
      // Helper: is this init "owned" by exactly one platform with no dept (goes under platform header)?
      const hasSinglePlatformOnly = (i) => (i.departmentIds || []).length === 0 && (i.platformIds || []).length === 1;

      // 1. Ungrouped: no dept and no platform, or ambiguous (multiple depts / multiple platforms without dept)
      for (const init of items.filter((i) => !hasSingleDept(i) && !hasSinglePlatformOnly(i))) {
        rows.push({ kind: 'init', init, bu, department: null, platform: null, y, h: ROW_H });
        y += ROW_H;
      }

      // 2. Department groups (BU-scoped, single-dept inits)
      const deptsHere = allDepts.filter((d) => d.buId === bu.id &&
        items.some((i) => hasSingleDept(i) && i.departmentIds[0] === d.id)
      );
      for (const dept of deptsHere) {
        const deptItems = items.filter((i) => hasSingleDept(i) && i.departmentIds[0] === dept.id);
        rows.push({ kind: 'department', department: dept, bu, y, h: DEPT_H });
        y += DEPT_H; // (was PLAT_H — the header then overlapped its first row by 6 px)
        for (const init of deptItems) {
          rows.push({ kind: 'init', init, bu, department: dept, platform: null, y, h: ROW_H });
          y += ROW_H;
        }
      }

      // 3. Platform groups (global, single-platform inits with no dept)
      const platformsHere = allPlatforms.filter((p) =>
        items.some((i) => hasSinglePlatformOnly(i) && i.platformIds[0] === p.id)
      );
      for (const platform of platformsHere) {
        const platItems = items.filter((i) => hasSinglePlatformOnly(i) && i.platformIds[0] === platform.id);
        rows.push({ kind: 'platform', platform, bu, y, h: PLAT_H });
        y += PLAT_H;
        for (const init of platItems) {
          rows.push({ kind: 'init', init, bu, department: null, platform, y, h: ROW_H });
          y += ROW_H;
        }
      }

      y += LANE_GAP;
    }
    return { rows, totalH: y };
  }, [store, filteredInits, buFilter, collapsedBUs]);

  const buBands = React.useMemo(() => {
    const buRows = layout.rows.filter((r) => r.kind === 'bu');
    return buRows.map((r) => {
      const allInBU = layout.rows.filter((x) => ['bu','init','platform','department'].includes(x.kind) && x.bu.id === r.bu.id);
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
    const xs = matched.flatMap((r) => { const b = barX(r.init); return [b.x1, b.x2]; });
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
    const xs = matched.flatMap((r) => { const b = barX(r.init); return [b.x1, b.x2]; });
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
        .map((r) => ({ id: r.init.id, buId: r.bu.id, ...barX(r.init), y: r.y + r.h / 2, isBlocker: false }));
    }
    if (litBlockerId) {
      return layout.rows
        .filter((r) => r.kind === 'init' && (r.init.blockerIds || []).includes(litBlockerId))
        .map((r) => ({ id: r.init.id, buId: r.bu.id, ...barX(r.init), y: r.y + r.h / 2, isBlocker: true }));
    }
    return [];
  }, [litTechId, litBlockerId, layout, dayPx]);

  // ── Scroll position: open on today, keep the centre when zooming ───────────
  // The label column is sticky over the left `labelW` px of the scroller, so
  // timeline x is visible at screen offset labelW + x - scrollLeft.
  const visibleTimelineW = () => {
    const el = scrollerRef.current;
    return el ? Math.max(0, el.clientWidth - labelWRef.current) : 0;
  };
  const leftForDate = (d) => Math.max(0, dateToX(d) - Math.min(2 * monthW, visibleTimelineW() / 3));

  // Opening the Gantt (first load, or back from another view) starts at today
  // instead of three months before the oldest initiative.
  const didInitialScrollRef = React.useRef(false);
  React.useEffect(() => {
    if (view !== 'gantt') { didInitialScrollRef.current = false; return; }
    const el = scrollerRef.current;
    if (!store || !el || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    el.scrollLeft = leftForDate(today);
  }, [view, store]);

  const zoomAnchorRef = React.useRef(null); // day offset at the centre of the view
  const changeZoom = (z) => {
    const el = scrollerRef.current;
    if (el && z !== zoom) zoomAnchorRef.current = (el.scrollLeft + visibleTimelineW() / 2) / dayPx;
    setZoom(z);
  };
  React.useLayoutEffect(() => {
    const el = scrollerRef.current, day = zoomAnchorRef.current;
    zoomAnchorRef.current = null;
    if (el && day != null) el.scrollLeft = Math.max(0, day * dayPx - visibleTimelineW() / 2);
  }, [zoom]);

  // Keyboard shortcuts on the Gantt. The handler is rebuilt every render (so it
  // sees current state) and read through a ref by one stable listener.
  const keyHandlerRef = React.useRef(null);
  React.useEffect(() => {
    const onKey = (e) => keyHandlerRef.current && keyHandlerRef.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // A scroll moves bars away under a still pointer without a mouseleave
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setHoverTip((t) => t ? null : t);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [view, !!store]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const updateInit = (id, patch) => setStore((s) => ({
    ...s, initiatives: s.initiatives.map((i) => i.id === id ? { ...i, ...patch } : i),
  }));

  // `orig` is the initiative as it was when the drawer opened. Only the fields
  // changed in the drawer are applied, so a colleague's concurrent edit to
  // another field (picked up while the drawer was open) isn't reverted.
  const saveInit = (d, orig) => {
    const isNew = !!d._new;
    const ok = setStore((s) => {
      const cleaned = { ...d }; delete cleaned._new;
      if (!cleaned.milestones)     cleaned.milestones     = [];
      if (!cleaned.blockerIds)     cleaned.blockerIds     = [];
      if (!cleaned.outcomeIds)     cleaned.outcomeIds     = [];
      if (!cleaned.platformIds)    cleaned.platformIds    = [];
      if (!cleaned.departmentIds)  cleaned.departmentIds  = [];
      const cur = s.initiatives.find((i) => i.id === d.id);
      if (!cur) return { ...s, initiatives: [...s.initiatives, cleaned] };
      const next = orig && !orig._new ? merge3(orig, cleaned, cur) : cleaned;
      return { ...s, initiatives: s.initiatives.map((i) => i.id === d.id ? next : i) };
    });
    if (!ok) return; // view-only: keep the drawer open while the user connects
    setDrawer(null);
    // Clear filters so a newly created initiative is always visible
    if (isNew) {
      setStatusFilter(null);
      setBuFilter(null);
    }
  };

  const delInit = (id) => {
    if (!setStore((s) => ({ ...s, initiatives: s.initiatives.filter((i) => i.id !== id) }))) return;
    setDrawer(null);
  };

  const updateAssess = (id, key, sub) => setStore((s) => ({
    ...s,
    initiatives: s.initiatives.map((i) => i.id !== id ? i : {
      ...i, assessment: { ...(i.assessment || {}), [key]: { ...(i.assessment?.[key] || {}), ...sub } },
    }),
  }));

  const setRankOrder = (ids) => setStore((s) => {
    const rankById = Object.fromEntries(ids.map((id, k) => [id, k + 1]));
    return {
      ...s,
      initiatives: s.initiatives.map((i) => rankById[i.id] === undefined ? i : {
        ...i, assessment: { ...(i.assessment || {}), rank: rankById[i.id] },
      }),
    };
  });

  const handleImport = (rows, extra) => {
    setStore((s) => {
      const newInits = rows.map((row, idx) => ({
        id: 'i_xl_' + Date.now() + '_' + idx,
        name: row.name,
        owner: row.owner || '',
        status: row.status.v || 'idea',
        buId: row.buId.v || null,
        departmentIds: row.departmentIds.v || [],
        techIds: row.techIds.v || [],
        blockerIds: row.blockerIds.v || [],
        outcomeIds: row.outcomeIds.v || [],
        platformIds: row.platformIds?.v || [],
        start: row.startDate.v || null,
        end:   row.endDate.v   || null,
        milestones: row.milestones.filter(m => m.date).map(m => ({ label: m.label, date: m.date })),
        synergyBuIds: [], pillarIds: [],
      }));
      return {
        ...s,
        technologies: [...s.technologies, ...extra.techs],
        blockers:     [...s.blockers,     ...extra.blockers],
        departments:  [...(s.departments || []), ...extra.departments],
        platforms:    [...(s.platforms || []),   ...(extra.platforms || [])],
        initiatives:  [...s.initiatives,  ...newInits],
      };
    });
  };

  const upsert = (arr, item) =>
    arr.some((x) => x.id === item.id) ? arr.map((x) => x.id === item.id ? item : x) : [...arr, item];

  const saveBU      = (d) => setStore((s) => ({ ...s, businessUnits: upsert(s.businessUnits, d) }));
  const delBU       = (id) => setStore((s) => {
    const remaining = s.businessUnits.filter((b) => b.id !== id);
    const fallback  = remaining[0]?.id || null;
    return {
      ...s,
      businessUnits: remaining,
      departments: (s.departments || []).filter((d) => d.buId !== id),
      initiatives:  s.initiatives.map((i) => i.buId === id ? { ...i, buId: fallback, departmentIds: [] } : i),
    };
  });

  const saveDepartment = (d) => setStore((s) => ({ ...s, departments: upsert(s.departments || [], d) }));
  const delDepartment  = (id) => setStore((s) => ({
    ...s,
    departments:  (s.departments || []).filter((d) => d.id !== id),
    initiatives:  s.initiatives.map((i) => ({
      ...i, departmentIds: (i.departmentIds || []).filter((x) => x !== id),
    })),
  }));

  const savePlatform = (d) => setStore((s) => ({ ...s, platforms: upsert(s.platforms || [], d) }));
  const delPlatform  = (id) => setStore((s) => ({
    ...s,
    platforms:   (s.platforms || []).filter((p) => p.id !== id),
    initiatives: s.initiatives.map((i) => ({
      ...i, platformIds: (i.platformIds || []).filter((x) => x !== id),
    })),
  }));

  const saveTech  = (d) => setStore((s) => ({ ...s, technologies: upsert(s.technologies, d) }));
  const delTech   = (id) => setStore((s) => ({
    ...s,
    technologies: s.technologies.filter((t) => t.id !== id),
    initiatives:  s.initiatives.map((i) => ({ ...i, techIds: (i.techIds || []).filter((x) => x !== id) })),
  }));

  const saveBlocker = (d) => setStore((s) => ({ ...s, blockers: upsert(s.blockers, d) }));
  const delBlocker  = (id) => setStore((s) => ({
    ...s,
    blockers:    s.blockers.filter((b) => b.id !== id),
    initiatives: s.initiatives.map((i) => ({ ...i, blockerIds: (i.blockerIds || []).filter((x) => x !== id) })),
  }));

  const saveOutcome = (d) => setStore((s) => ({ ...s, outcomes: upsert(s.outcomes || [], d) }));
  const delOutcome  = (id) => setStore((s) => ({
    ...s,
    outcomes:    (s.outcomes || []).filter((o) => o.id !== id),
    initiatives: s.initiatives.map((i) => ({ ...i, outcomeIds: (i.outcomeIds || []).filter((x) => x !== id) })),
  }));

  const newInit = (buId) => connectedRef.current ? openNewInit(buId) : setShowPatSetup(true);
  const openNewInit = (buId) => setDrawer({
    _new: true, id: 'i_' + Math.random().toString(36).slice(2, 7),
    buId: buId || (store.businessUnits[0] && store.businessUnits[0].id) || 'mkt',
    platformIds: [], departmentIds: [],
    name: '', status: 'idea', owner: '',
    techIds: [], blockerIds: [], outcomeIds: [], tags: [], purpose: '', need: '', solution: '',
    start: dateToISO(today), end: dateToISO(addDays(today, 120)),
    milestones: [],
  });

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e) => e.stopPropagation();
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (noAccess) return <NoAccessScreen kind={noAccess} />;
  if (!store) return <LoadingScreen message="Henter data…" />;

  const techById    = _byId(store.technologies);
  const buById      = _byId(store.businessUnits);
  const outcomeById = _byId(store.outcomes || []);

  // First colorHue per outcome category (pillar) — plain object, no hook
  const pillarColorMap = {};
  for (const o of (store.outcomes || [])) {
    if (pillarColorMap[o.category] == null) pillarColorMap[o.category] = o.colorHue;
  }

  const scrollTo = (date) => {
    if (!scrollerRef.current) return;
    // (Was dateToX + labelW - 120, which parked the date behind the sticky label column.)
    scrollerRef.current.scrollTo({ left: leftForDate(date), behavior: 'smooth' });
  };
  const scrollByMonths = (delta) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: delta * monthW, behavior: 'smooth' });
  };

  const ZOOMS = [0.75, 1, 1.5];
  const anyModalOpen = !!(drawer || catalogue || showPatSetup || (connected && (askName || !editorName)));
  keyHandlerRef.current = (e) => {
    if (view !== 'gantt' || anyModalOpen || !scrollerRef.current) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const zi = ZOOMS.indexOf(zoom);
    if (e.key === 't' || e.key === 'T')      scrollTo(today);
    else if (e.key === 'ArrowLeft')          scrollByMonths(e.shiftKey ? -3 : -1);
    else if (e.key === 'ArrowRight')         scrollByMonths(e.shiftKey ? 3 : 1);
    else if (e.key === '+' || e.key === '=') { if (zi < ZOOMS.length - 1) changeZoom(ZOOMS[zi + 1]); }
    else if (e.key === '-')                  { if (zi > 0) changeZoom(ZOOMS[zi - 1]); }
    else if (e.key === 'Escape' && hoverTip) setHoverTip(null);
    else return;
    e.preventDefault();
  };

  // Hover card handlers shared by bars and label rows
  const showTip = (ev, init, bu) => { if (!draggingRef.current) setHoverTip({ init, bu, x: ev.clientX, y: ev.clientY }); };
  const hideTip = () => setHoverTip(null);

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'data.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const startLabelResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = labelWRef.current;
    const onMove = (ev) => {
      const newW = Math.max(160, Math.min(520, startW + ev.clientX - startX));
      labelWRef.current = newW;
      setLabelW(newW);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const startBarDrag = (e, init, mode) => {
    if (!connectedRef.current) return; // view-only: a click still opens the drawer
    // A missing start / BAU end stays missing: only real dates move. (Before,
    // dragging a BAU bar wrote end: "NaN-NaN-NaN" from parseISO(null).)
    const hasStart = isValidISO(init.start), hasEnd = isValidISO(init.end);
    if ((mode === 'move' && !hasStart && !hasEnd) || (mode === 'rL' && !hasStart) || (mode === 'rR' && !hasEnd)) return;
    e.stopPropagation(); e.preventDefault();
    setHoverTip(null);
    const startX = e.clientX;
    const origStart = hasStart ? parseISO(init.start) : null, origEnd = hasEnd ? parseISO(init.end) : null;
    const datesPatch = (ns, ne) => ({
      ...(hasStart ? { start: dateToISO(ns) } : null),
      ...(hasEnd   ? { end:   dateToISO(ne) } : null),
    });
    let dragged = false;
    const apply = (dx) => {
      const dxDays = Math.round(dx / dayPx);
      if (dxDays === 0) { updateInit(init.id, datesPatch(origStart, origEnd)); return; }
      let ns = origStart, ne = origEnd;
      if (mode === 'move') {
        if (hasStart) ns = addDays(origStart, dxDays);
        if (hasEnd)   ne = addDays(origEnd,   dxDays);
      } else if (mode === 'rR') {
        ne = addDays(origEnd, dxDays);
        if (hasStart && ne <= addDays(origStart, 6)) ne = addDays(origStart, 7);
      } else if (mode === 'rL') {
        ns = addDays(origStart, dxDays);
        if (hasEnd && ns >= addDays(origEnd, -6)) ns = addDays(origEnd, -7);
      }
      const patch = datesPatch(ns, ne);
      if (mode === 'move' && init.milestones && init.milestones.length) {
        patch.milestones = init.milestones.map((m) => isValidISO(m.date)
          ? { ...m, date: dateToISO(addDays(parseISO(m.date), dxDays)) }
          : m);
      }
      updateInit(init.id, patch);
    };
    draggingRef.current = true;
    const onMove = (ev) => { const dx = ev.clientX - startX; if (Math.abs(dx) > 3) dragged = true; if (dragged) apply(dx); };
    const onUp   = () => {
      draggingRef.current = false;
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
  const onBarClick = (init) => { if (dragSuppressRef.current === init.id) return; setHoverTip(null); setDrawer({ ...init }); };

  const getBarStyle = (init, bu) => {
    const status      = resolveStatus(init.status, store.statuses);
    const hasBlockers = (init.blockerIds || []).length > 0;
    const inBlockerMatch = selectedBlockers.size > 0 && blockerMatchedSet.has(init.id);
    const inTechMatch    = selectedTechs.size    > 0 && matchedSet.has(init.id);
    const inOutcomeMatch = selectedOutcomes.size > 0 && outcomeMatchedSet.has(init.id);
    let dim = false, isHot = false, borderLeftColor = status.color, bgOverride = null, glowColor = null;
    if (selectedBlockers.size > 0) {
      dim = !inBlockerMatch; isHot = inBlockerMatch;
      if (isHot) { borderLeftColor = BLOCKER_RED; glowColor = BLOCKER_RED; }
    } else if (selectedOutcomes.size > 0) {
      dim = !inOutcomeMatch; isHot = inOutcomeMatch;
      if (isHot) { borderLeftColor = OUTCOME_TEAL; glowColor = OUTCOME_TEAL; }
    } else if (selectedTechs.size > 0) {
      dim = !inTechMatch; isHot = inTechMatch;
      if (isHot) glowColor = bu.accent;
    } else if (blockerMode) {
      dim = !hasBlockers;
      if (hasBlockers) { borderLeftColor = BLOCKER_RED; bgOverride = `color-mix(in oklch, ${BLOCKER_RED} 6%, ${UI.panel})`; }
    }
    const baseShadow = isHot && glowColor
      ? `0 0 0 2px ${glowColor}, 0 0 0 4px color-mix(in oklch, ${glowColor} 25%, transparent), 0 6px 16px rgba(20,16,12,.1)`
      : UI.shadow;
    // Blocked bars always carry a red underline, so blockers read at a glance
    // without switching blocker mode on.
    const boxShadow = hasBlockers
      ? `inset 0 -3px 0 color-mix(in oklch, ${BLOCKER_RED} 75%, transparent), ${baseShadow}`
      : baseShadow;
    return { status, hasBlockers, dim, isHot, borderLeftColor, bgOverride, boxShadow };
  };

  // ── Sync status indicator ─────────────────────────────────────────────────
  const SyncIndicator = () => {
    const dot = (color) => <span style={{ width: 6, height: 6, borderRadius: 99, background: color, flex: '0 0 auto' }} />;
    const smallBtn = (color, label, onClick, title) => (
      <button onClick={onClick} title={title} style={{ border: `1px solid ${color}`, background: 'transparent', color, borderRadius: 4, cursor: 'pointer', padding: '1px 6px', fontSize: 9.5, fontFamily: UI.mono }}>{label}</button>
    );
    const wrap = (color, label, onClick) => (
      <span onClick={onClick} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: UI.mono, fontSize: 10, color,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }} title={onClick ? `Gemmer i ${SYNC_CFG.repo} — klik for at afbryde forbindelsen` : undefined}>
        {dot(color)}{label}
      </span>
    );

    const askDisconnect = () => {
      const sy = syncRef.current;
      const unsaved = sy.timer || sy.inflight || !deepEq(storeRef.current, sy.base);
      if (!confirm(unsaved
        ? 'Du har ændringer der ikke er gemt endnu — de går tabt. Afbryd GitHub-forbindelsen alligevel?'
        : 'Afbryd GitHub-forbindelsen? Boardet bliver skrivebeskyttet i denne browser.')) return;
      localStorage.removeItem(PAT_KEY);
      disconnect();
    };
    const changePat = () => { localStorage.removeItem(PAT_KEY); disconnect(); setShowPatSetup(true); };
    const errorRow = (label, ...buttons) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: UI.mono, fontSize: 10 }}>
        {dot(BLOCKER_RED)}<span style={{ color: BLOCKER_RED }}>{label}</span>{buttons}
      </span>
    );

    // In link mode the connection comes from the link — no disconnect, no token talk
    const onStatus = SYNC_CFG.linkMode ? undefined : askDisconnect;
    const nameChip = connected && editorName ? (
      <button key="n" onClick={() => setAskName(true)} title="Skift navn" style={{
        border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px',
        fontFamily: UI.mono, fontSize: 10, color: UI.inkMuted,
      }}>✎ {editorName}</button>
    ) : null;
    const withName = (el) => nameChip
      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{nameChip}{el}</span>
      : el;

    if (syncStatus === 'loading') return wrap(UI.inkFaint, 'Henter…');
    if (syncStatus === 'saving')  return withName(wrap('oklch(0.62 0.14 70)',  'Gemmer…'));
    if (syncStatus === 'saved')   return withName(wrap('oklch(0.52 0.13 150)', 'Gemt ✓', onStatus));
    if (syncStatus === 'idle')    return withName(wrap(UI.inkFaint, SYNC_CFG.linkMode ? 'Gemmes automatisk' : 'GitHub', onStatus));
    if (syncStatus === 'error')   return withName(errorRow('Ikke gemt',
      <React.Fragment key="r">{smallBtn(BLOCKER_RED, '↺ Prøv igen', flush, 'Dine ændringer er stadig her — prøv at gemme igen')}</React.Fragment>));
    if (syncStatus === 'load-error') return errorRow('Kan ikke hente — kun visning',
      <React.Fragment key="r">{smallBtn(BLOCKER_RED, '↺ Prøv igen', () => loadFromGitHub(localStorage.getItem(PAT_KEY), localStorage.getItem(MODE_KEY) || 'edit', false))}</React.Fragment>,
      SYNC_CFG.linkMode ? null : <React.Fragment key="p">{smallBtn(UI.inkMuted, 'Skift token', changePat)}</React.Fragment>);
    if (syncStatus === 'auth-error') return SYNC_CFG.linkMode
      ? errorRow(connected ? 'Linket virker ikke længere — ændringer er ikke gemt' : 'Linket virker ikke længere')
      : errorRow(connected ? 'Token afvist — ikke gemt' : 'Token afvist — kun visning',
          <React.Fragment key="p">{smallBtn(BLOCKER_RED, 'Skift token', changePat, 'Tokenet er udløbet eller mangler adgang')}</React.Fragment>);
    if (syncStatus === 'readonly') return (
      <button onClick={() => setShowPatSetup(true)} title={SYNC_CFG.linkMode ? 'Du har et visningslink' : 'Forbind til GitHub for at oprette og redigere initiativer'} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 9px', borderRadius: 5, cursor: 'pointer',
        border: `1px solid ${UI.border}`, background: 'transparent',
        color: UI.inkMuted, fontFamily: UI.mono, fontSize: 10,
      }}>{SYNC_CFG.linkMode ? 'Kun visning' : 'Kun visning · ✎ Redigér'}</button>
    );
    return null;
  };

  // Calendar header: quarter row + month row + a row for the "I dag" marker
  const CAL_Q_H = 22, CAL_M_H = 26, CAL_T_H = 20;
  const CAL_H = CAL_Q_H + CAL_M_H + CAL_T_H;
  const todayX  = dateToX(today);
  const todayIn = todayX >= 0 && todayX <= timelineW;
  const boardSum = laneSummary(filteredInits, store.statuses, today);

  const months = monthList.map((d) => ({
    key: `${d.getFullYear()}-${d.getMonth()}`, d,
    x1: dateToX(d),
    x2: Math.min(timelineW, dateToX(new Date(d.getFullYear(), d.getMonth() + 1, 1))),
    qStart: d.getMonth() % 3 === 0,
    current: d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth(),
  }));
  const quarters = [];
  for (const m of months) {
    const q = quarterOf(m.d), y = m.d.getFullYear();
    const last = quarters[quarters.length - 1];
    if (last && last.q === q && last.year === y) { last.x2 = m.x2; continue; }
    quarters.push({
      key: `${y}-Q${q}`, q, year: y, label: `Q${q}`, x1: m.x1, x2: m.x2,
      start: new Date(y, (q - 1) * 3, 1),
      current: y === today.getFullYear() && q === quarterOf(today),
    });
  }

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
            {[null, ...STATUSES.filter((s) => s.id !== 'idea').map((s) => s.id)].map((id) => (
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
            {['gantt', 'portfolio'].map((v) => (
              <button key={v} onClick={() => setView(v)} style={chipBtn(view === v, true)}>
                {v === 'gantt' ? 'Gantt' : 'Portfolio'}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 2px' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => scrollByMonths(-1)} title="En måned tilbage (←, Shift+← = kvartal)" style={chipBtn(false, true)} disabled={view !== 'gantt'}>‹</button>
            <button onClick={() => scrollTo(today)} title="Gå til i dag (T)" style={chipBtn(false, true)} disabled={view !== 'gantt'}>I dag</button>
            <button onClick={() => scrollByMonths(1)} title="En måned frem (→, Shift+→ = kvartal)" style={chipBtn(false, true)} disabled={view !== 'gantt'}>›</button>
            {ZOOMS.map((z) => (
              <button key={z} onClick={() => changeZoom(z)} title="Zoom (+ / −)" style={chipBtn(zoom === z, true)} disabled={view !== 'gantt'}>
                {z === 0.75 ? 'S' : z === 1 ? 'M' : 'L'}
              </button>
            ))}
          </div>
          <UiButton variant="primary" onClick={() => newInit()} icon={<span style={{ fontSize: 14, lineHeight: 0 }}>+</span>}>Ny</UiButton>
          <div style={{ width: 1, height: 22, background: UI.border, margin: '0 2px' }} />
          <UiButton size="sm" variant="soft" onClick={() => { setCatalogue(true); setDrawer(null); }} icon={<span style={{ fontSize: 13, lineHeight: 0 }}>⊞</span>}>Catalogue</UiButton>
          <button onClick={downloadJSON} title="Download board-data som data.json" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 9px', borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${UI.border}`, background: 'transparent',
            color: UI.inkMuted, fontFamily: UI.mono, fontSize: 10,
          }}>↓ JSON</button>
          <button onClick={() => connectedRef.current ? setView('import') : setShowPatSetup(true)} title="Importer initiativer fra Excel" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
            border: 'none', fontFamily: UI.mono, fontSize: 10, fontWeight: 600,
            background: view === 'import' ? 'oklch(0.42 0.14 145)' : 'oklch(0.52 0.14 145)',
            color: '#fff',
          }}>↑ Import</button>
          <button onClick={() => setView(view === 'ideas' ? 'gantt' : 'ideas')} title="Idéer og boblere" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
            border: view === 'ideas' ? 'none' : `1px solid ${UI.border}`,
            fontFamily: UI.mono, fontSize: 10, fontWeight: 600,
            background: view === 'ideas' ? 'oklch(0.58 0.13 70)' : 'transparent',
            color: view === 'ideas' ? '#fff' : UI.inkMuted,
          }}>💡 Idea</button>
          <button onClick={() => setView(view === 'tech' ? 'gantt' : 'tech')} title="Initiativer pr. teknologi med vurdering og prioritet" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
            border: view === 'tech' ? 'none' : `1px solid ${UI.border}`,
            fontFamily: UI.mono, fontSize: 10, fontWeight: 600,
            background: view === 'tech' ? UI.ink : 'transparent',
            color: view === 'tech' ? '#fff' : UI.inkMuted,
          }}>◇ Teknologi</button>
          <SyncIndicator />
        </>}
      />

      {/* ── Filter strip (Tech + Blockers + Outcomes) — Gantt only ──────── */}
      {view === 'gantt' && (
        <FilterStrip
          store={{ ...store, initiatives: ganttInits }}
          selectedTechs={selectedTechs} selectedBlockers={selectedBlockers} selectedOutcomes={selectedOutcomes}
          toggleTech={toggleTech} toggleBlocker={toggleBlocker} toggleOutcome={toggleOutcome}
          techSynergy={techSynergy} blockerSynergy={blockerSynergy} outcomeSynergy={outcomeSynergy}
          matchMode={matchMode} setMatchMode={setMatchMode}
          blockerMode={blockerMode} setBlockerMode={setBlockerMode}
          filteredInits={filteredInits} matchedSet={matchedSet} blockerMatchedSet={blockerMatchedSet}
          outcomeMatchedSet={outcomeMatchedSet}
          onClearTechs={() => setSelectedTechs(new Set())}
          onClearBlockers={() => setSelectedBlockers(new Set())}
          onClearOutcomes={() => setSelectedOutcomes(new Set())}
        />
      )}

      {/* ── Portfolio view ────────────────────────────────────────────────── */}
      {view === 'portfolio' && (
        <UiPortfolioView
          store={{ ...store, initiatives: store.initiatives.filter(i => i.status !== 'idea') }}
          onOpenInit={(i) => setDrawer({ ...i })} />
      )}

      {/* ── Ideas / Boblere view ──────────────────────────────────────────── */}
      {view === 'ideas' && (
        <UiIdeasView store={store} onOpenInit={(i) => setDrawer({ ...i })} onUpdateAssess={updateAssess} onUpdateInit={updateInit}
          onCreateInit={(init) => setStore((s) => ({ ...s, initiatives: [...s.initiatives, init] }))} />
      )}

      {/* ── Technology view ───────────────────────────────────────────────── */}
      {view === 'tech' && (
        <UiTechInitiativesView store={store} onOpenInit={(i) => setDrawer({ ...i })} onRankOrder={setRankOrder} onUpdateAssess={updateAssess} />
      )}

      {/* ── Import view ───────────────────────────────────────────────────── */}
      {view === 'import' && (
        <UiImportView store={store} onImport={handleImport} onGoToBoard={() => setView('gantt')} />
      )}

      {/* ── Gantt (full width) ────────────────────────────────────────────── */}
      {view === 'gantt' && <div ref={scrollerRef} className="board-scroller" style={{ flex: 1, overflow: 'auto', position: 'relative', minWidth: 0, minHeight: 0 }}>
        <div style={{ display: 'flex', minWidth: labelW + timelineW, position: 'relative' }}>

          {/* ── Label column (sticky left) ─────────────────────────────── */}
          <div style={{
            width: labelW, flex: '0 0 auto', position: 'sticky', left: 0, zIndex: 4,
            background: UI.panel, borderRight: `1px solid ${UI.border}`,
          }}>
            {/* Resize handle */}
            <div
              onPointerDown={startLabelResize}
              style={{
                position: 'absolute', right: -4, top: 0, bottom: 0, width: 8,
                cursor: 'col-resize', zIndex: 10, userSelect: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.firstChild.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.firstChild.style.opacity = '0';
              }}
            >
              <div style={{
                width: 3, height: 40, borderRadius: 99,
                background: UI.accent, opacity: 0,
                transition: 'opacity .15s', pointerEvents: 'none',
              }} />
            </div>
            {/* Corner header — sticky on top too, so the board totals stay in
                view while scrolling a long list of lanes. */}
            <div title={laneSummaryText(boardSum)} style={{
              height: CAL_H, borderBottom: `1px solid ${UI.border}`, boxSizing: 'border-box',
              position: 'sticky', top: 0, zIndex: 5,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 5,
              padding: '0 14px 9px 20px', background: UI.panelSoft, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: UI.mono, fontSize: 10, color: UI.inkMuted }}>
                <span style={{ color: UI.ink, fontWeight: 700, fontSize: 11 }}>{boardSum.total} initiativer</span>
                {boardSum.blocked > 0 && <span style={{ color: BLOCKER_RED, fontWeight: 700 }}>⚠ {boardSum.blocked} blokeret</span>}
                {boardSum.overdue > 0 && <span style={{ color: OVERDUE_AMBER, fontWeight: 700 }}>⏱ {boardSum.overdue} over slutdato</span>}
              </div>
              <div style={{ fontFamily: UI.mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: UI.inkFaint }}>Forretningsenhed / Initiativ</div>
            </div>

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
                  const blockedInBU = ganttInits.filter((i) => i.buId === r.bu.id && (i.blockerIds || []).length > 0).length;
                  const hiddenHits = r.collapsed && highlightSet
                    ? r.items.filter((i) => highlightSet.has(i.id)).length
                    : 0;
                  return (
                    <div key={'bu:' + r.bu.id} style={{
                      position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                      padding: '0 12px 0 8px', display: 'flex', alignItems: 'center', gap: 7,
                      borderBottom: `1px solid ${UI.border}`,
                      background: `linear-gradient(90deg, color-mix(in oklch, ${r.bu.accent} 8%, ${UI.panel}) 0%, ${UI.panel} 100%)`,
                    }}>
                      <button
                        onClick={() => toggleBUCollapse(r.bu.id)}
                        title={r.collapsed ? `Fold ${r.bu.name} ud` : `Fold ${r.bu.name} sammen`}
                        aria-expanded={!r.collapsed}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: '0 1 auto',
                          background: 'transparent', border: 'none', padding: '2px 2px', margin: 0,
                          cursor: 'pointer', color: UI.ink, textAlign: 'left', font: 'inherit',
                        }}>
                        <span style={{
                          width: 12, flex: '0 0 auto', textAlign: 'center', fontSize: 9, color: UI.inkMuted,
                          display: 'inline-block',
                          transform: r.collapsed ? 'rotate(-90deg)' : 'none',
                          transition: 'transform .15s',
                        }}>▼</span>
                        <span style={{ width: 9, height: 9, flex: '0 0 auto', borderRadius: 99, background: r.bu.accent }} />
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: UI.ink, minWidth: 0,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{r.bu.name}</span>
                      </button>
                      <span style={{
                        fontFamily: UI.mono, fontSize: 9.5, color: UI.inkFaint, flex: '0 0 auto',
                        background: UI.panelSoft, border: `1px solid ${UI.border}`,
                        borderRadius: 4, padding: '1px 5px',
                      }}>{r.count}</span>
                      {blockedInBU > 0 && (
                        <span title={`${blockedInBU} initiativ${blockedInBU === 1 ? '' : 'er'} med blockers`} style={{ fontFamily: UI.mono, fontSize: 9, color: BLOCKER_RED, fontWeight: 700, flex: '0 0 auto' }}>⚠{blockedInBU}</span>
                      )}
                      {hiddenHits > 0 && (
                        <span title={`${hiddenHits} match(es) skjult i denne enhed`} style={{
                          fontFamily: UI.mono, fontSize: 9, fontWeight: 700, color: r.bu.accent, flex: '0 0 auto',
                          background: `color-mix(in oklch, ${r.bu.accent} 12%, transparent)`,
                          border: `1px solid color-mix(in oklch, ${r.bu.accent} 30%, transparent)`,
                          borderRadius: 4, padding: '1px 5px',
                        }}>⌕{hiddenHits}</span>
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

                if (r.kind === 'department') {
                  return (
                    <div key={'dept:' + r.department.id + ':' + r.y} style={{
                      position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                      padding: '0 12px 0 22px', display: 'flex', alignItems: 'center', gap: 6,
                      borderBottom: `1px solid color-mix(in oklch, ${r.bu.accent} 28%, transparent)`,
                      background: `color-mix(in oklch, ${r.bu.accent} 11%, ${UI.panel})`,
                      borderLeft: `3px solid color-mix(in oklch, ${r.bu.accent} 65%, transparent)`,
                    }}>
                      <span style={{ fontFamily: UI.sans, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.1, color: UI.ink }}>{r.department.name}</span>
                    </div>
                  );
                }

                if (r.kind === 'platform') {
                  return (
                    <div key={'plat:' + r.platform.id + ':' + r.y} style={{
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
                  const isGrouped = r.department || r.platform;
                  const initPlatforms = (r.init.platformIds || []).map((pid) => (store.platforms || []).find((p) => p.id === pid)).filter(Boolean);
                  const initDepts = !r.department
                    ? (r.init.departmentIds || []).map((did) => (store.departments || []).find((d) => d.id === did)).filter(Boolean)
                    : [];
                  return (
                    <div key={r.init.id} onClick={() => { hideTip(); setDrawer({ ...r.init }); }} style={{
                      position: 'absolute', top: r.y, left: 0, right: 0, height: r.h,
                      padding: `0 12px 0 ${isGrouped ? 40 : 28}px`, display: 'flex', alignItems: 'center', gap: 7,
                      cursor: 'pointer', opacity: dim ? 0.35 : 1, transition: 'opacity .15s',
                      borderBottom: `1px solid color-mix(in oklch, ${UI.border} 60%, transparent)`,
                      borderLeft: isGrouped ? `3px solid color-mix(in oklch, ${r.bu.accent} 45%, transparent)` : 'none',
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = UI.panelSoft; showTip(e, r.init, r.bu); }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; hideTip(); }}>
                      <UiStatusPill status={r.init.status} statuses={store.statuses} size="sm" />
                      <div style={{
                        flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: UI.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{r.init.name}</div>
                      {/* Only the first department and platform get a chip, capped in
                          width, so the name always keeps room; the rest become "+N". */}
                      {initDepts.slice(0, 1).map((dep) => (
                        <span key={dep.id} title={dep.name} style={{
                          fontFamily: UI.sans, fontSize: 8.5, fontWeight: 600, flexShrink: 0,
                          color: UI.inkMuted, whiteSpace: 'nowrap', maxWidth: 90,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          background: UI.panelSoft,
                          border: `1px solid ${UI.border}`,
                          padding: '1px 5px', borderRadius: 3,
                        }}>{dep.name}</span>
                      ))}
                      {initPlatforms.slice(0, 1).map((p) => (
                        <span key={p.id} title={p.name} style={{
                          fontFamily: UI.mono, fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                          color: r.bu.accent, letterSpacing: 0.3, whiteSpace: 'nowrap', maxWidth: 90,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          background: `color-mix(in oklch, ${r.bu.accent} 8%, transparent)`,
                          border: `1px solid color-mix(in oklch, ${r.bu.accent} 22%, transparent)`,
                          padding: '1px 5px', borderRadius: 3,
                        }}>{p.name}</span>
                      ))}
                      {(() => {
                        const rest = [...initDepts.slice(1), ...initPlatforms.slice(1)];
                        return rest.length > 0 && (
                          <span title={rest.map((x) => x.name).join(', ')} style={{
                            fontFamily: UI.mono, fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                            color: UI.inkMuted, whiteSpace: 'nowrap',
                          }}>+{rest.length}</span>
                        );
                      })()}
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
            {/* Months and quarters sit at their real date positions (dateToX),
                so the grid, the bars and the today line always agree. */}
            <div style={{ height: CAL_H, position: 'sticky', top: 0, zIndex: 3, background: UI.panelSoft, borderBottom: `1px solid ${UI.border}`, width: timelineW }}>
              {quarters.map((q) => (
                <button key={q.key} onClick={() => scrollTo(q.start)} title={`Gå til ${q.label} ${q.year}`} style={{
                  position: 'absolute', top: 0, left: q.x1, width: q.x2 - q.x1, height: CAL_Q_H,
                  padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap',
                  fontFamily: UI.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                  color: q.current ? UI.accent : UI.inkMuted, fontWeight: q.current ? 700 : 400,
                  background: q.current ? `color-mix(in oklch, ${UI.accent} 9%, transparent)` : 'transparent',
                  border: 'none', borderLeft: q.x1 > 0 ? `1px solid ${UI.borderStrong}` : 'none',
                  cursor: 'pointer',
                }}>{q.label} <span style={{ color: q.current ? UI.accent : UI.inkFaint, opacity: q.current ? 0.75 : 1 }}>{q.year}</span>
                  {q.current && <span style={{ fontSize: 8.5, letterSpacing: 0.6 }}>· nu</span>}</button>
              ))}
              {months.map((m) => (
                <div key={m.key} style={{
                  position: 'absolute', top: CAL_Q_H, left: m.x1, width: m.x2 - m.x1, height: CAL_M_H,
                  padding: '0 8px', display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
                  borderLeft: m.x1 > 0 ? `1px ${m.qStart ? 'solid' : 'dashed'} ${m.qStart ? UI.borderStrong : UI.border}` : 'none',
                  fontFamily: UI.mono, fontSize: 11,
                  color: m.current ? UI.accent : UI.inkMuted,
                  fontWeight: m.current ? 700 : 400,
                }}>{fmtMon(m.d)}{m.d.getMonth() === 0 && <span style={{ color: UI.inkFaint, fontSize: 9, marginLeft: 4 }}>{m.d.getFullYear()}</span>}</div>
              ))}
              {todayIn && (<>
                <div style={{ position: 'absolute', left: todayX - 1, top: CAL_Q_H + CAL_M_H - 4, bottom: -1, width: 2, background: UI.accent }} />
                <div title={`I dag: ${fmtDate(today)}`} style={{
                  position: 'absolute', top: CAL_Q_H + CAL_M_H + 1, left: todayX, transform: 'translateX(-50%)',
                  padding: '2px 7px', background: UI.accent, color: '#fff', borderRadius: 99, whiteSpace: 'nowrap',
                  fontFamily: UI.mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.3,
                }}>I DAG · {fmtDay(today).toUpperCase()}</div>
              </>)}
            </div>

            {/* Timeline body */}
            <div style={{ position: 'relative', height: layout.totalH, width: timelineW }}>
              {/* Month lines; quarter starts are drawn stronger */}
              {months.map((m) => m.x1 > 0 && (
                <div key={'ml:' + m.key} style={{
                  position: 'absolute', top: 0, left: m.x1, bottom: 0, width: 1, pointerEvents: 'none',
                  background: m.qStart ? UI.borderStrong : UI.border, opacity: m.qStart ? 0.9 : 0.5,
                }} />
              ))}

              {quarters.map((q) => (q.q + q.year) % 2 === 0 && (
                <div key={'qb:' + q.key} style={{ position: 'absolute', top: 0, left: q.x1, width: q.x2 - q.x1, bottom: 0, background: 'color-mix(in oklch, oklch(0.6 0.04 80) 3%, transparent)', pointerEvents: 'none' }} />
              ))}

              {/* The current quarter gets a faint accent wash, the past a grey veil */}
              {quarters.filter((q) => q.current).map((q) => (
                <div key={'qc:' + q.key} style={{ position: 'absolute', top: 0, left: q.x1, width: q.x2 - q.x1, bottom: 0, background: `color-mix(in oklch, ${UI.accent} 3%, transparent)`, pointerEvents: 'none' }} />
              ))}
              {todayX > 0 && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: Math.min(todayX, timelineW), bottom: 0, background: 'color-mix(in oklch, oklch(0.45 0.01 80) 4%, transparent)', pointerEvents: 'none' }} />
              )}

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

              {layout.rows.filter((r) => r.kind === 'bu').map((r) => {
                // Expanded lanes show their key numbers in the otherwise empty
                // header row, pinned just right of the label column while
                // scrolling sideways. (Collapsed lanes show them on the roll-up.)
                const sum = !r.collapsed && r.items.length ? laneSummary(r.items, store.statuses, today) : null;
                return (
                  <div key={'lbg:' + r.bu.id} style={{
                    position: 'absolute', top: r.y, left: 0, width: timelineW, height: r.h,
                    borderBottom: `1px solid ${UI.border}`,
                    background: `color-mix(in oklch, ${r.bu.accent} 5%, transparent)`,
                    // Above the today line (z 2), so the line never cuts through the chips
                    pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 3,
                  }}>
                    {sum && <LaneSummaryChips sum={sum} sticky={labelW + 10} />}
                  </div>
                );
              })}

              {layout.rows.filter((r) => r.kind === 'department').map((r) => (
                <div key={'deptbg:' + r.department.id + ':' + r.y} style={{
                  position: 'absolute', top: r.y, left: 0, width: timelineW, height: r.h,
                  borderBottom: `1px solid color-mix(in oklch, ${r.bu.accent} 28%, transparent)`,
                  background: `color-mix(in oklch, ${r.bu.accent} 9%, transparent)`,
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

              {platformSpans.map((s) => (
                <div key={'thread:' + s.platform.id} style={{
                  position: 'absolute', top: s.y1 + PLAT_H, left: 3, width: 2,
                  height: s.y2 - s.y1 - PLAT_H,
                  background: `color-mix(in oklch, ${s.bu.accent} 32%, transparent)`,
                  borderRadius: 1, pointerEvents: 'none', zIndex: 1,
                }} />
              ))}

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
              {/* (Its "I dag" label lives in the sticky calendar header, so it
                  stays visible however far down the board is scrolled.) */}
              {todayIn && (
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, width: 2, left: todayX - 1, zIndex: 2, pointerEvents: 'none',
                  background: UI.accent, boxShadow: `0 0 0 3px color-mix(in oklch, ${UI.accent} 12%, transparent)`,
                }} />
              )}

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

              {/* Roll-up bars for collapsed lanes — a collapsed BU still shows
                  the span its initiatives cover, so the lane isn't a dead row. */}
              {layout.rows.map((r) => {
                if (r.kind !== 'bu' || !r.collapsed || !r.items.length) return null;
                const starts = r.items.map((i) => parseISO(i.start)).filter((d) => !isNaN(d));
                const ends   = r.items.filter((i) => i.end).map((i) => parseISO(i.end)).filter((d) => !isNaN(d));
                const bau    = r.items.some((i) => !i.end);
                if (!starts.length && !ends.length) return null;
                const s  = starts.length ? starts.reduce((a, b) => a < b ? a : b) : range.start;
                const x  = dateToX(s);
                const x2 = bau ? timelineW
                              : (ends.length ? dateToX(ends.reduce((a, b) => a > b ? a : b)) : timelineW);
                const barW  = Math.max(24, x2 - x);
                const fadeW = bau ? Math.min(80, Math.max(36, barW * 0.25)) : 0;
                const sumText = laneSummaryText(laneSummary(r.items, store.statuses, today));
                return (
                  <div key={'rollup:' + r.bu.id}
                    onClick={() => toggleBUCollapse(r.bu.id)}
                    title={`${r.bu.name} — ${sumText} · klik for at folde ud`}
                    style={{
                      position: 'absolute', top: r.y + 12, left: x, width: barW, height: 16,
                      borderRadius: bau ? '5px 0 0 5px' : 5, cursor: 'pointer', zIndex: 1,
                      ...(bau ? {
                        WebkitMaskImage: `linear-gradient(to right, #000 calc(100% - ${fadeW}px), transparent 100%)`,
                        maskImage:       `linear-gradient(to right, #000 calc(100% - ${fadeW}px), transparent 100%)`,
                      } : null),
                      background: `repeating-linear-gradient(115deg, color-mix(in oklch, ${r.bu.accent} 26%, ${UI.panel}) 0 6px, color-mix(in oklch, ${r.bu.accent} 15%, ${UI.panel}) 6px 12px)`,
                      border: `1px solid color-mix(in oklch, ${r.bu.accent} 42%, transparent)`,
                      display: 'flex', alignItems: 'center',
                      paddingLeft: 8, paddingRight: bau ? Math.round(fadeW + 8) : 8,
                      overflow: 'hidden', userSelect: 'none',
                    }}>
                    <span style={{
                      fontFamily: UI.mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                      color: `color-mix(in oklch, ${r.bu.accent} 75%, ${UI.ink})`, whiteSpace: 'nowrap',
                    }}>{sumText}</span>
                  </div>
                );
              })}

              {/* Initiative bars */}
              {layout.rows.map((r) => {
                if (r.kind !== 'init') return null;
                const i = r.init;
                const noStart = !i.start;
                const noEnd   = !i.end;
                const s    = noStart ? range.start : parseISO(i.start);
                const e    = noEnd   ? range.end   : parseISO(i.end);
                const x = dateToX(s);
                // BAU: run all the way to the end of the timeline and fade out,
                // so the bar never appears to stop on a particular date.
                const barW = noEnd ? Math.max(24, timelineW - x)
                                   : Math.max(24, dateToX(e) - x);
                const fadeW = noEnd ? Math.min(80, Math.max(36, barW * 0.25)) : 0;
                // Keep bar content (tech/outcome chips) clear of both the fade
                // and the sticky BAU badge — otherwise the chips render
                // half-transparent and crowd the badge at the right edge.
                const padR  = noEnd ? Math.round(fadeW + 14) : 10;
                const { status, hasBlockers, dim, isHot, borderLeftColor, bgOverride, boxShadow } = getBarStyle(i, r.bu);
                const showChips = barW >= 72;
                const dateRange = noStart && noEnd ? 'løbende'
                               : noStart           ? `◀ – ${fmtDay(e)}`
                               : noEnd             ? `${fmtDay(s)} – ▶ BAU`
                               :                    `${fmtDay(s)} – ${fmtDay(e)}`;
                return (
                  <div key={i.id}
                    onPointerDown={(ev) => { if (ev.target.closest('[data-no-drag]')) return; startBarDrag(ev, i, 'move'); }}
                    onClick={() => onBarClick(i)}
                    onMouseEnter={(ev) => showTip(ev, i, r.bu)}
                    onMouseLeave={hideTip}
                    aria-label={`${i.name} · ${dateRange}${hasBlockers ? ` · ${(i.blockerIds || []).length} blocker(s)` : ''}`}
                    style={{
                      position: 'absolute', top: r.y + 7, left: x, width: barW, height: r.h - 14,
                      borderRadius: noEnd ? '6px 0 0 6px' : 6, cursor: connected ? 'grab' : 'pointer',
                      ...(noEnd ? {
                        WebkitMaskImage: `linear-gradient(to right, #000 calc(100% - ${fadeW}px), transparent 100%)`,
                        maskImage:       `linear-gradient(to right, #000 calc(100% - ${fadeW}px), transparent 100%)`,
                      } : null),
                      background: bgOverride || `color-mix(in oklch, ${status.color} ${i.status === 'prod' ? 18 : 12}%, ${UI.panel})`,
                      border: `1px solid color-mix(in oklch, ${status.color} 35%, transparent)`,
                      borderLeft: `3px solid ${borderLeftColor}`,
                      boxShadow, opacity: dim ? 0.22 : 1,
                      transition: 'opacity .15s, box-shadow .15s',
                      display: 'flex', alignItems: 'center',
                      paddingLeft: noStart ? 36 : 10, paddingRight: padR,
                      overflow: 'visible', zIndex: isHot ? 3 : 1,
                      userSelect: 'none', touchAction: 'none',
                    }}>
                    {/* Likewise no left handle without a start date */}
                    {!noStart && <div data-no-drag onPointerDown={(ev) => startBarDrag(ev, i, 'rL')} style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} />}
                    {/* No right resize handle on BAU bars — dragging it would
                        silently turn "løbende" into a fixed end date. */}
                    {!noEnd && <div data-no-drag onPointerDown={(ev) => startBarDrag(ev, i, 'rR')} style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 8, cursor: 'ew-resize' }} />}
                    {hasBlockers && (
                      <span style={{
                        fontFamily: UI.mono, fontSize: 9, color: '#fff', background: BLOCKER_RED, fontWeight: 700,
                        flex: '0 0 auto', marginRight: 5, lineHeight: 1, padding: '2px 4px', borderRadius: 3, whiteSpace: 'nowrap',
                      }}>⚠{barW >= 60 ? ` ${(i.blockerIds || []).length}` : ''}</span>
                    )}
                    {barW >= 90 && (i.platformIds || []).slice(0, 2).map((pid) => {
                      const plat = (store.platforms || []).find((p) => p.id === pid);
                      if (!plat) return null;
                      return (
                        <span key={pid} style={{
                          fontFamily: UI.mono, fontSize: 8, fontWeight: 700, flex: '0 0 auto', marginRight: 3,
                          color: r.bu.accent, letterSpacing: 0.3, whiteSpace: 'nowrap',
                          background: `color-mix(in oklch, ${r.bu.accent} 10%, ${UI.panel})`,
                          border: `1px solid color-mix(in oklch, ${r.bu.accent} 25%, transparent)`,
                          padding: '1px 4px', borderRadius: 3, lineHeight: 1,
                        }}>{plat.name}</span>
                      );
                    })}
                    {barW >= 90 && (i.platformIds || []).length > 2 && (
                      <span style={{ fontSize: 8, color: r.bu.accent, fontFamily: UI.mono, marginRight: 3 }}>+{i.platformIds.length - 2}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11.5, fontWeight: 600, color: UI.ink }}>{i.name}</div>
                    {showChips && (i.outcomeIds || []).length > 0 && (() => {
                      const myPillars = [...new Set((i.outcomeIds || []).map((oid) => outcomeById[oid]?.category).filter(Boolean))];
                      return myPillars.length > 0 ? (
                        <div style={{ display: 'flex', gap: 2, marginLeft: 4, flex: '0 0 auto' }}>
                          {myPillars.slice(0, 4).map((pillar, pi) => (
                            <span key={pi} title={pillar} style={{
                              width: 6, height: 6, borderRadius: 99, flex: '0 0 auto',
                              background: `oklch(0.52 0.12 ${pillarColorMap[pillar] ?? 155})`,
                              opacity: 0.75,
                            }} />
                          ))}
                        </div>
                      ) : null;
                    })()}
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
                        <span key={idx}
                          data-no-drag
                          onPointerDown={(ev) => ev.stopPropagation()}
                          onMouseEnter={(ev) => {
                            const r = ev.currentTarget.getBoundingClientRect();
                            setMilestoneTooltip({ label: m.label, date: m.date, x: r.left + r.width / 2, y: r.top });
                          }}
                          onMouseLeave={() => setMilestoneTooltip(null)}
                          style={{
                            position: 'absolute', top: '50%', left: mx, width: 9, height: 9,
                            transform: 'translate(-50%, -50%) rotate(45deg)',
                            background: '#fff', border: `1.5px solid ${status.color}`,
                            boxShadow: '0 1px 2px rgba(20,16,12,.15)',
                            pointerEvents: 'auto', cursor: 'default', zIndex: 2,
                          }} />
                      );
                    })}
                    {noStart && (
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 30,
                        background: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.35) 4px, rgba(255,255,255,0.35) 8px)',
                        borderRadius: '6px 0 0 6px',
                        display: 'flex', alignItems: 'center', paddingLeft: 4,
                        pointerEvents: 'none',
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.6 }}>◀</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* BAU markers — sticky to the right edge of the scroller so the
                  "keeps running" cue stays visible at any scroll position. */}
              {layout.rows.map((r) => {
                if (r.kind !== 'init' || r.init.end) return null;
                const { status } = getBarStyle(r.init, r.bu);
                return (
                  <div key={`bau-${r.init.id}`} style={{
                    position: 'absolute', top: r.y + 7, left: 0, right: 0, height: r.h - 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    pointerEvents: 'none', zIndex: 2,
                  }}>
                    <span title="Løbende / BAU — ingen slutdato" style={{
                      position: 'sticky', right: 6, display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontFamily: UI.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4,
                      color: status.color,
                      background: `color-mix(in oklch, ${status.color} 10%, ${UI.panel})`,
                      border: `1px solid color-mix(in oklch, ${status.color} 30%, transparent)`,
                      borderRadius: 3, padding: '1px 4px',
                    }}>BAU ▶</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>}

      {/* Initiative drawer */}
      {drawer && (
        <UiInitiativeDrawer store={store} draft={drawer}
          onClose={() => setDrawer(null)} onSave={(d) => saveInit(d, drawer)} onDelete={delInit} />
      )}

      {/* Catalogue drawer */}
      {catalogue && (
        <UiCatalogueDrawer
          store={store}
          onClose={() => setCatalogue(false)}
          onSaveBU={saveBU}                 onDelBU={delBU}
          onSaveDepartment={saveDepartment} onDelDepartment={delDepartment}
          onSavePlatform={savePlatform}     onDelPlatform={delPlatform}
          onSaveTech={saveTech}             onDelTech={delTech}
          onSaveBlocker={saveBlocker}       onDelBlocker={delBlocker}
          onSaveOutcome={saveOutcome}       onDelOutcome={delOutcome}
        />
      )}

      {/* Milestone tooltip */}
      {milestoneTooltip && (
        <div style={{
          position: 'fixed', zIndex: 9999, pointerEvents: 'none',
          left: milestoneTooltip.x, top: milestoneTooltip.y - 8,
          transform: 'translate(-50%, -100%)',
          background: UI.ink, color: '#fff',
          fontSize: 11, fontFamily: UI.sans, lineHeight: 1.4,
          padding: '4px 8px', borderRadius: 5,
          boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          whiteSpace: 'nowrap',
        }}>
          {milestoneTooltip.label}
          <span style={{ opacity: 0.6, marginLeft: 5 }}>{isValidISO(milestoneTooltip.date) ? fmtDate(parseISO(milestoneTooltip.date)) : milestoneTooltip.date}</span>
        </div>
      )}

      {/* Initiative hover card — yields to the milestone tooltip and to drawers */}
      {hoverTip && view === 'gantt' && !milestoneTooltip && !anyModalOpen && (
        <BarHoverCard tip={hoverTip} store={store} today={today} canEdit={connected} />
      )}

      {/* GitHub PAT setup overlay */}
      {/* Editors name themselves once, so history shows who changed what */}
      {connected && (askName || !editorName) && (
        <NamePrompt initial={editorName}
          onSave={(n) => { try { localStorage.setItem(NAME_KEY, n); } catch (_) {} setEditorName(n); setAskName(false); }}
          onCancel={editorName ? () => setAskName(false) : null} />
      )}

      {showPatSetup && (
        <PatSetupOverlay
          onConnect={onPatConnect}
          onSkip={() => setShowPatSetup(false)}
        />
      )}
    </div>
  );
}

window.BoardView = BoardView;

ReactDOM.createRoot(document.getElementById('root')).render(<BoardView />);
