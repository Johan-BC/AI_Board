// Shared data definitions + Excel parsing helpers.
// The app loads data.xlsx from the server on first run and uses that as its
// source of truth. CRUD changes made in the UI are saved to localStorage so
// edits survive a page reload. "Reload from Excel" clears localStorage and
// re-parses the file; "Import Excel" lets the user pick any .xlsx file.

const PLATFORMS = [
  { id: 'adobe',   name: 'Adobe',   businessUnitId: 'mkt', accent: 'oklch(0.62 0.14 25)',  tint: 'oklch(0.97 0.02 25)'  },
  { id: 'cognigy', name: 'Cognigy', businessUnitId: 'cxo', accent: 'oklch(0.55 0.13 250)', tint: 'oklch(0.97 0.02 250)' },
  { id: 'genesys', name: 'Genesys', businessUnitId: 'cxo', accent: 'oklch(0.62 0.13 60)',  tint: 'oklch(0.97 0.02 60)'  },
];

const BUSINESS_UNITS = [
  { id: 'mkt', name: 'Marketing',           short: 'MK', accent: 'oklch(0.45 0.08 290)', lead: 'Anne Berg' },
  { id: 'cxo', name: 'Customer Operations', short: 'CO', accent: 'oklch(0.45 0.08 165)', lead: 'Mads Iversen' },
];

const STATUSES = [
  { id: 'idea',  label: 'Idea',  color: 'oklch(0.55 0.005 80)'  },
  { id: 'poc',   label: 'POC',   color: 'oklch(0.55 0.12 240)' },
  { id: 'pilot', label: 'Pilot', color: 'oklch(0.62 0.14 70)'  },
  { id: 'live',  label: 'Live',  color: 'oklch(0.52 0.13 150)' },
];

const TECHNOLOGIES = [
  { id: 't_stt',     name: 'speechToText',     category: 'Speech' },
  { id: 't_whisper', name: 'Whisper',          category: 'Speech' },
  { id: 't_xcript',  name: 'AutoTranscript',   category: 'Speech' },
  { id: 't_aa',      name: 'Agent Assist',     category: 'Agent tooling' },
  { id: 't_auto',    name: 'Agent automation', category: 'Agent tooling' },
  { id: 't_aiadd',   name: 'AIADDAssistant',   category: 'Assistant' },
];

const INITIATIVES = [
  { id: 'i_camp',  platformId: 'adobe',   name: 'Personalised campaign generation', status: 'poc',   owner: 'Marketing',     techIds: ['t_aiadd'],                              tags: ['B2C','EU'],          description: 'Generate variant copy + creative per segment.',
    start: '2026-03-01', end: '2026-09-30', milestones: [{ date: '2026-06-15', label: 'Pilot kickoff' }] },
  { id: 'i_tag',   platformId: 'adobe',   name: 'Asset auto-tagging',               status: 'live',  owner: 'DAM team',      techIds: ['t_aiadd','t_xcript'],                    tags: ['Content ops'],       description: 'Classify and tag the stock library.',
    start: '2025-11-01', end: '2026-12-31', milestones: [{ date: '2026-04-10', label: 'Go-live' }] },
  { id: 'i_brief', platformId: 'adobe',   name: 'Creative brief assistant',         status: 'idea',  owner: 'Brand studio',  techIds: ['t_aiadd'],                              tags: ['Internal'],          description: 'Turn brand book + brief into starter creative.',
    start: '2026-09-01', end: '2027-02-28', milestones: [] },

  { id: 'i_it',    platformId: 'cognigy', name: 'IT helpdesk bot',                  status: 'live',  owner: 'IT',            techIds: ['t_aa','t_auto','t_aiadd'],              tags: ['Internal'],          description: 'Tier-0 IT support across Slack + portal.',
    start: '2025-09-01', end: '2026-12-31', milestones: [{ date: '2026-02-01', label: 'Go-live' }, { date: '2026-08-15', label: 'EN+DK rollout' }] },
  { id: 'i_voice', platformId: 'cognigy', name: 'Customer voicebot',                status: 'pilot', owner: 'Customer Care', techIds: ['t_stt','t_whisper','t_auto','t_aa'],    tags: ['B2C','24/7'],     description: 'Voice-first front door for service line.',
    start: '2026-02-01', end: '2026-11-30', milestones: [{ date: '2026-07-01', label: 'Pilot live' }] },
  { id: 'i_sales', platformId: 'cognigy', name: 'Sales co-pilot',                   status: 'idea',  owner: 'Sales Ops',     techIds: ['t_aiadd','t_aa'],                       tags: ['Internal'],          description: 'Suggest next-best-action mid-call.',
    start: '2026-08-01', end: '2027-01-31', milestones: [] },

  { id: 'i_route', platformId: 'genesys', name: 'Predictive routing',               status: 'poc',   owner: 'Contact Centre',techIds: ['t_auto','t_aa'],                        tags: ['Optimisation'],      description: 'Match calls to best-fit agents.',
    start: '2026-04-01', end: '2026-12-31', milestones: [{ date: '2026-10-15', label: 'POC review' }] },
  { id: 'i_sum',   platformId: 'genesys', name: 'Call summarisation',               status: 'live',  owner: 'Contact Centre',techIds: ['t_stt','t_xcript','t_whisper'],         tags: ['Productivity'],      description: 'Auto-summarise calls into CRM.',
    start: '2025-12-01', end: '2026-12-31', milestones: [{ date: '2026-03-20', label: 'Go-live' }] },
  { id: 'i_qa',    platformId: 'genesys', name: 'Agent-assist QA',                  status: 'pilot', owner: 'Quality',       techIds: ['t_xcript','t_aa','t_stt'],              tags: ['Compliance'],        description: 'Score 100% of interactions vs. rubrics.',
    start: '2026-03-01', end: '2026-10-31', milestones: [{ date: '2026-06-01', label: 'Pilot live' }] },
];

const _byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

function makeStore() {
  return {
    platforms:     JSON.parse(JSON.stringify(PLATFORMS)),
    statuses:      JSON.parse(JSON.stringify(STATUSES)),
    technologies:  JSON.parse(JSON.stringify(TECHNOLOGIES)),
    initiatives:   JSON.parse(JSON.stringify(INITIATIVES)),
    businessUnits: JSON.parse(JSON.stringify(BUSINESS_UNITS)),
  };
}

function techUsage(initiatives, techId, scope = null) {
  return initiatives.filter((i) =>
    (!scope || i.platformId === scope) && i.techIds.includes(techId)
  );
}

function sharedTechIds(initiatives) {
  const counts = {};
  for (const i of initiatives) for (const t of i.techIds) counts[t] = (counts[t] || 0) + 1;
  return Object.keys(counts).filter((k) => counts[k] > 1);
}

// ── Excel parsing ─────────────────────────────────────────────────────────────
// Reads an SheetJS workbook object produced by XLSX.read() and converts it
// to the same shape as makeStore(). Column headers must match the data.xlsx
// template exactly (case-insensitive trim). Missing sheets fall back to the
// built-in seed arrays so a partial workbook still renders.

function parseWorkbook(wb) {
  const str = (v) => String(v == null ? '' : v).trim();

  // Convert a sheet to an array of plain objects keyed by header row.
  // defval:'' so missing cells don't become undefined.
  const rows = (name) => {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    return (typeof XLSX !== 'undefined')
      ? XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
      : [];
  };

  // Normalise header names to lowercase-no-spaces for resilient lookup.
  const norm = (s) => str(s).toLowerCase().replace(/\s+/g, '');

  function pickRow(r, ...keys) {
    // Try each alias in order; return the first non-empty value.
    for (const k of keys) {
      for (const rk of Object.keys(r)) {
        if (norm(rk) === norm(k) && str(r[rk]) !== '') return str(r[rk]);
      }
    }
    return '';
  }

  const businessUnits = rows('Business Units').map((r) => ({
    id:     pickRow(r, 'id'),
    name:   pickRow(r, 'name'),
    short:  pickRow(r, 'short'),
    accent: pickRow(r, 'accent color', 'accent') || 'oklch(0.45 0.08 250)',
    lead:   pickRow(r, 'lead'),
  })).filter((b) => b.id && b.name);

  const platforms = rows('Platforms').map((r) => ({
    id:             pickRow(r, 'id'),
    name:           pickRow(r, 'name'),
    businessUnitId: pickRow(r, 'business unit id', 'businessunitid'),
    accent:         pickRow(r, 'accent color', 'accent') || 'oklch(0.62 0.12 250)',
    tint:           pickRow(r, 'tint color', 'tint')     || 'oklch(0.97 0.02 250)',
  })).filter((p) => p.id && p.name);

  const technologies = rows('Technologies').map((r) => ({
    id:       pickRow(r, 'id'),
    name:     pickRow(r, 'name'),
    category: pickRow(r, 'category'),
  })).filter((t) => t.id && t.name);

  // Build a name→id index so the Initiatives sheet can reference tech by name.
  const techByName = {};
  for (const t of technologies) techByName[t.name.toLowerCase()] = t.id;

  // Milestones grouped by initiativeId.
  const milestonesByInit = {};
  for (const m of rows('Milestones')) {
    const iid = pickRow(m, 'initiative id', 'initiativeid');
    if (!iid) continue;
    if (!milestonesByInit[iid]) milestonesByInit[iid] = [];
    const date = pickRow(m, 'date');
    const label = pickRow(m, 'label');
    if (date) milestonesByInit[iid].push({ date, label });
  }

  const validStatuses = new Set(['idea', 'poc', 'pilot', 'live']);

  const initiatives = rows('Initiatives').map((r) => {
    const id = pickRow(r, 'id');
    const rawTechs = pickRow(r, 'technologies');
    const techIds = rawTechs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => techByName[name.toLowerCase()])
      .filter(Boolean);

    const status = pickRow(r, 'status').toLowerCase();

    return {
      id,
      platformId:  pickRow(r, 'platform id', 'platformid'),
      name:        pickRow(r, 'name'),
      status:      validStatuses.has(status) ? status : 'idea',
      owner:       pickRow(r, 'owner'),
      start:       pickRow(r, 'start date', 'start'),
      end:         pickRow(r, 'end date', 'end'),
      description: pickRow(r, 'description'),
      tags:        pickRow(r, 'tags').split(',').map((s) => s.trim()).filter(Boolean),
      techIds,
      milestones:  milestonesByInit[id] || [],
    };
  }).filter((i) => i.id && i.name);

  return {
    platforms:     platforms.length     ? platforms     : JSON.parse(JSON.stringify(PLATFORMS)),
    statuses:      JSON.parse(JSON.stringify(STATUSES)),  // status colors are always app-defined
    technologies:  technologies.length  ? technologies  : JSON.parse(JSON.stringify(TECHNOLOGIES)),
    initiatives:   initiatives.length   ? initiatives   : JSON.parse(JSON.stringify(INITIATIVES)),
    businessUnits: businessUnits.length ? businessUnits : JSON.parse(JSON.stringify(BUSINESS_UNITS)),
  };
}

// Parse an ArrayBuffer (e.g. from fetch or FileReader) into a store.
function parseExcelBuffer(buf) {
  if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) not loaded');
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: true });
  return parseWorkbook(wb);
}

Object.assign(window, {
  PLATFORMS, STATUSES, TECHNOLOGIES, INITIATIVES, BUSINESS_UNITS,
  makeStore, techUsage, sharedTechIds, _byId,
  parseWorkbook, parseExcelBuffer,
});
