// Data layer: BU → Platform → Initiative hierarchy.
// Excel is the source of truth; localStorage preserves CRUD edits.

const BUSINESS_UNITS = [
  { id: 'mkt', name: 'Marketing',      short: 'MK', accent: 'oklch(0.48 0.12 290)', lead: 'Anne Berg' },
  { id: 'cxo', name: 'Cust. Ops',      short: 'CO', accent: 'oklch(0.48 0.12 165)', lead: 'Mads Iversen' },
  { id: 'dig', name: 'Digital & Data', short: 'DD', accent: 'oklch(0.55 0.13 55)',  lead: 'Sofie Lund' },
];

const PLATFORMS = [
  { id: 'p_adobe',   name: 'Adobe',    buId: 'mkt' },
  { id: 'p_genesys', name: 'Genesys',  buId: 'cxo' },
  { id: 'p_boost',   name: 'Boost.ai', buId: 'cxo' },
];

const STATUSES = [
  { id: 'idea',  label: 'Idea',  color: 'oklch(0.55 0.005 80)'  },
  { id: 'poc',   label: 'POC',   color: 'oklch(0.55 0.12 240)'  },
  { id: 'pilot', label: 'Pilot', color: 'oklch(0.62 0.14 70)'   },
  { id: 'live',  label: 'Live',  color: 'oklch(0.52 0.13 150)'  },
];

const TECHNOLOGIES = [
  { id: 't_gpt',     name: 'GPT-4o',           category: 'LLM',           colorHue: 250 },
  { id: 't_azure',   name: 'Azure OpenAI',      category: 'LLM',           colorHue: 220 },
  { id: 't_rag',     name: 'RAG / Vector DB',   category: 'LLM',           colorHue: 290 },
  { id: 't_whisper', name: 'Whisper STT',       category: 'Speech',        colorHue: 30  },
  { id: 't_xcript',  name: 'AutoTranscript',    category: 'Speech',        colorHue: 50  },
  { id: 't_aa',      name: 'Agent Assist',      category: 'Agent tooling', colorHue: 180 },
  { id: 't_auto',    name: 'Agent Automation',  category: 'Agent tooling', colorHue: 200 },
  { id: 't_copilot', name: 'Copilot M365',      category: 'Assistant',     colorHue: 150 },
];

const BLOCKERS = [
  { id: 'b_legal',  name: 'Legal review',        category: 'Godkendelse',   colorHue: 10  },
  { id: 'b_budget', name: 'Budget godkendelse',   category: 'Godkendelse',   colorHue: 30  },
  { id: 'b_gdpr',   name: 'GDPR compliance',      category: 'Godkendelse',   colorHue: 5   },
  { id: 'b_it',     name: 'IT infrastruktur',     category: 'Teknik',        colorHue: 200 },
  { id: 'b_vendor', name: 'Vendor kontrakt',      category: 'Teknik',        colorHue: 220 },
  { id: 'b_data',   name: 'Data adgang',          category: 'Teknik',        colorHue: 240 },
  { id: 'b_talent', name: 'Kompetencer',          category: 'Organisation',  colorHue: 60  },
  { id: 'b_res',    name: 'Ressourcer/kapacitet', category: 'Organisation',  colorHue: 70  },
];

const INITIATIVES = [
  // ── Marketing ──────────────────────────────────────────────────────────────
  {
    id: 'i_camp', buId: 'mkt', platformId: 'p_adobe', name: 'Personalised campaign generation',
    status: 'poc', owner: 'Marketing Ops',
    techIds: ['t_gpt', 't_azure'], blockerIds: ['b_legal', 'b_gdpr'],
    tags: ['B2C', 'EU'], description: 'Generate variant copy + creative per segment using LLMs.',
    start: '2026-03-01', end: '2026-09-30',
    milestones: [{ date: '2026-06-15', label: 'Pilot kickoff' }],
  },
  {
    id: 'i_tag', buId: 'mkt', platformId: 'p_adobe', name: 'Asset auto-tagging',
    status: 'live', owner: 'DAM team',
    techIds: ['t_gpt', 't_rag'], blockerIds: [],
    tags: ['Content ops'], description: 'Classify and tag the DAM stock library automatically.',
    start: '2025-11-01', end: '2026-12-31',
    milestones: [{ date: '2026-04-10', label: 'Go-live' }],
  },
  {
    id: 'i_seo', buId: 'mkt', name: 'SEO content assistant',
    status: 'idea', owner: 'Brand studio',
    techIds: ['t_gpt', 't_azure'], blockerIds: ['b_budget'],
    tags: ['Content', 'SEO'], description: 'Draft SEO-optimised articles from briefs and keywords.',
    start: '2026-09-01', end: '2027-02-28',
    milestones: [],
  },
  {
    id: 'i_persona', buId: 'mkt', name: 'Customer persona engine',
    status: 'pilot', owner: 'Insights',
    techIds: ['t_rag'], blockerIds: ['b_talent'],
    tags: ['Analytics', 'B2C'], description: 'Build dynamic customer segments from behavioural data.',
    start: '2026-04-01', end: '2026-11-30',
    milestones: [{ date: '2026-07-01', label: 'Pilot live' }],
  },

  // ── Customer Operations ────────────────────────────────────────────────────
  {
    id: 'i_voice', buId: 'cxo', platformId: 'p_boost', name: 'Customer voicebot',
    status: 'pilot', owner: 'Customer Care',
    techIds: ['t_whisper', 't_auto', 't_aa'], blockerIds: ['b_legal', 'b_it'],
    tags: ['B2C', '24/7'], description: 'Voice-first front door for the service line.',
    start: '2026-02-01', end: '2026-11-30',
    milestones: [{ date: '2026-07-01', label: 'Pilot live' }],
  },
  {
    id: 'i_helpdesk', buId: 'cxo', platformId: 'p_genesys', name: 'IT helpdesk bot',
    status: 'live', owner: 'IT',
    techIds: ['t_gpt', 't_aa', 't_auto'], blockerIds: ['b_gdpr'],
    tags: ['Internal'], description: 'Tier-0 IT support via Slack and employee portal.',
    start: '2025-09-01', end: '2026-12-31',
    milestones: [{ date: '2026-02-01', label: 'Go-live' }, { date: '2026-08-15', label: 'EN+DK rollout' }],
  },
  {
    id: 'i_sum', buId: 'cxo', name: 'Call summarisation',
    status: 'live', owner: 'Contact Centre',
    techIds: ['t_whisper', 't_xcript'], blockerIds: [],
    tags: ['Productivity'], description: 'Auto-summarise calls and write them into CRM.',
    start: '2025-12-01', end: '2026-12-31',
    milestones: [{ date: '2026-03-20', label: 'Go-live' }],
  },
  {
    id: 'i_qa', buId: 'cxo', platformId: 'p_genesys', name: 'Agent-assist QA',
    status: 'pilot', owner: 'Quality',
    techIds: ['t_xcript', 't_aa'], blockerIds: ['b_vendor'],
    tags: ['Compliance'], description: 'Score 100 % of interactions against quality rubrics.',
    start: '2026-03-01', end: '2026-10-31',
    milestones: [{ date: '2026-06-01', label: 'Pilot live' }],
  },

  // ── Digital & Data ─────────────────────────────────────────────────────────
  {
    id: 'i_search', buId: 'dig', name: 'Enterprise knowledge search',
    status: 'poc', owner: 'Platform team',
    techIds: ['t_gpt', 't_rag'], blockerIds: ['b_legal', 'b_vendor', 'b_data'],
    tags: ['Internal'], description: 'RAG-based search across internal wikis and documents.',
    start: '2026-04-01', end: '2026-12-31',
    milestones: [{ date: '2026-10-15', label: 'POC review' }],
  },
  {
    id: 'i_trans', buId: 'dig', name: 'Meeting transcription',
    status: 'live', owner: 'Workplace IT',
    techIds: ['t_whisper', 't_xcript', 't_copilot'], blockerIds: ['b_it'],
    tags: ['Productivity'], description: 'Transcribe, summarise, and action-item all meetings.',
    start: '2026-01-01', end: '2026-12-31',
    milestones: [{ date: '2026-03-01', label: 'Go-live' }],
  },
  {
    id: 'i_assist', buId: 'dig', name: 'Developer copilot',
    status: 'pilot', owner: 'Engineering',
    techIds: ['t_gpt', 't_copilot', 't_azure'], blockerIds: ['b_talent'],
    tags: ['DevEx'], description: 'In-IDE code suggestions tuned to internal patterns.',
    start: '2026-03-01', end: '2026-09-30',
    milestones: [{ date: '2026-06-01', label: 'Pilot live' }],
  },
  {
    id: 'i_predict', buId: 'dig', name: 'Predictive analytics engine',
    status: 'idea', owner: 'Data Science',
    techIds: ['t_rag', 't_auto'], blockerIds: ['b_budget', 'b_data', 'b_res'],
    tags: ['Analytics'], description: 'Forecast churn and NPS from interaction and CRM data.',
    start: '2026-09-01', end: '2027-03-31',
    milestones: [],
  },
];

const _byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

function makeStore() {
  return {
    statuses:      JSON.parse(JSON.stringify(STATUSES)),
    technologies:  JSON.parse(JSON.stringify(TECHNOLOGIES)),
    blockers:      JSON.parse(JSON.stringify(BLOCKERS)),
    initiatives:   JSON.parse(JSON.stringify(INITIATIVES)),
    businessUnits: JSON.parse(JSON.stringify(BUSINESS_UNITS)),
    platforms:     JSON.parse(JSON.stringify(PLATFORMS)),
  };
}

// Returns Map<itemId, Set<buId>> across all initiatives.
function buildSynergyMap(initiatives, field) {
  const map = new Map();
  for (const i of initiatives) {
    for (const id of (i[field] || [])) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(i.buId);
    }
  }
  return map;
}

// ── Excel parsing ─────────────────────────────────────────────────────────────
function parseWorkbook(wb) {
  const str = (v) => String(v == null ? '' : v).trim();

  const rows = (name) => {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    return (typeof XLSX !== 'undefined')
      ? XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
      : [];
  };

  const norm = (s) => str(s).toLowerCase().replace(/\s+/g, '');

  function pickRow(r, ...keys) {
    for (const k of keys) {
      for (const rk of Object.keys(r)) {
        if (norm(rk) === norm(k) && str(r[rk]) !== '') return str(r[rk]);
      }
    }
    return '';
  }

  function parseDate(v) {
    if (typeof v === 'number' && v > 40000 && v < 60000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    return str(v);
  }

  const platforms = rows('Platforms').map((r) => ({
    id:   pickRow(r, 'id'),
    name: pickRow(r, 'name'),
    buId: pickRow(r, 'business unit id', 'businessunitid', 'buid'),
  })).filter((p) => p.id && p.name && p.buId);

  const businessUnits = rows('Business_Units').map((r) => ({
    id:     pickRow(r, 'id'),
    name:   pickRow(r, 'name'),
    short:  pickRow(r, 'short'),
    accent: pickRow(r, 'accent color', 'accent') || 'oklch(0.45 0.08 250)',
    lead:   pickRow(r, 'lead'),
  })).filter((b) => b.id && b.name);

  const technologies = rows('Technologies').map((r) => ({
    id:       pickRow(r, 'id'),
    name:     pickRow(r, 'name'),
    category: pickRow(r, 'category'),
    colorHue: parseInt(pickRow(r, 'color hue', 'colorhue'), 10) || null,
  })).filter((t) => t.id && t.name);

  const blockers = rows('Blockers').map((r) => ({
    id:       pickRow(r, 'id'),
    name:     pickRow(r, 'name'),
    category: pickRow(r, 'category'),
    colorHue: parseInt(pickRow(r, 'color hue', 'colorhue'), 10) || null,
  })).filter((b) => b.id && b.name);

  const techByName = {};
  for (const t of technologies) techByName[t.name.toLowerCase()] = t.id;

  const blockerByName = {};
  for (const b of blockers) blockerByName[b.name.toLowerCase()] = b.id;

  const milestonesByInit = {};
  for (const m of rows('Milestones')) {
    const iid = pickRow(m, 'initiative id', 'initiativeid');
    if (!iid) continue;
    if (!milestonesByInit[iid]) milestonesByInit[iid] = [];
    const date = parseDate(m['Date'] || m['date'] || pickRow(m, 'date'));
    const label = pickRow(m, 'label');
    if (date) milestonesByInit[iid].push({ date, label });
  }

  const validStatuses = new Set(['idea', 'poc', 'pilot', 'live']);

  const initiatives = rows('Initiatives').map((r) => {
    const id = pickRow(r, 'id');
    const rawTechs = pickRow(r, 'technologies');
    const techIds = rawTechs
      .split(',').map((s) => s.trim()).filter(Boolean)
      .map((name) => techByName[name.toLowerCase()]).filter(Boolean);

    const rawBlockers = pickRow(r, 'blockers');
    const blockerIds = rawBlockers
      .split(',').map((s) => s.trim()).filter(Boolean)
      .map((name) => blockerByName[name.toLowerCase()]).filter(Boolean);

    const status = pickRow(r, 'status').toLowerCase();
    const startRaw = r['Start Date'] || r['start date'] || r['Start'] || pickRow(r, 'start date', 'start');
    const endRaw   = r['End Date']   || r['end date']   || r['End']   || pickRow(r, 'end date', 'end');
    return {
      id,
      buId:        pickRow(r, 'business unit id', 'businessunitid', 'buid'),
      platformId:  pickRow(r, 'platform id', 'platformid') || null,
      name:        pickRow(r, 'name'),
      status:      validStatuses.has(status) ? status : 'idea',
      owner:       pickRow(r, 'owner'),
      start:       parseDate(startRaw),
      end:         parseDate(endRaw),
      description: pickRow(r, 'description'),
      tags:        pickRow(r, 'tags').split(',').map((s) => s.trim()).filter(Boolean),
      techIds,
      blockerIds,
      milestones:  milestonesByInit[id] || [],
    };
  }).filter((i) => i.id && i.name);

  return {
    statuses:      JSON.parse(JSON.stringify(STATUSES)),
    technologies:  technologies.length  ? technologies  : JSON.parse(JSON.stringify(TECHNOLOGIES)),
    blockers:      blockers.length      ? blockers      : JSON.parse(JSON.stringify(BLOCKERS)),
    initiatives:   initiatives.length   ? initiatives   : JSON.parse(JSON.stringify(INITIATIVES)),
    businessUnits: businessUnits.length ? businessUnits : JSON.parse(JSON.stringify(BUSINESS_UNITS)),
    platforms:     platforms.length     ? platforms     : JSON.parse(JSON.stringify(PLATFORMS)),
  };
}

function parseExcelBuffer(buf) {
  if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) not loaded');
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: true });
  return parseWorkbook(wb);
}

Object.assign(window, {
  BUSINESS_UNITS, PLATFORMS, STATUSES, TECHNOLOGIES, BLOCKERS, INITIATIVES,
  makeStore, buildSynergyMap, _byId,
  parseWorkbook, parseExcelBuffer,
});
