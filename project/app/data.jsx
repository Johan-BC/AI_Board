// Shared seed data + small store helpers used by every variation.
// Each artboard mounts its own copy of this seed and mutates it locally,
// so users can demo CRUD without affecting the other variations.

const PLATFORMS = [
  { id: 'adobe',   name: 'Adobe',   businessUnitId: 'mkt', accent: 'oklch(0.62 0.14 25)',  tint: 'oklch(0.97 0.02 25)'  },
  { id: 'cognigy', name: 'Cognigy', businessUnitId: 'cxo', accent: 'oklch(0.55 0.13 250)', tint: 'oklch(0.97 0.02 250)' },
  { id: 'genesys', name: 'Genesys', businessUnitId: 'cxo', accent: 'oklch(0.62 0.13 60)',  tint: 'oklch(0.97 0.02 60)'  },
];

// Forretningsenheder — ejere af platforme. `short` = 1–2 bogstaver til
// avatar-ikonet; `accent` er en afdæmpet farve med lavere chroma end
// platform-accenten så de to identiteter ikke konkurrerer visuelt.
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

// `start` / `end` are ISO yyyy-mm-dd. `milestones` are optional anchor
// points rendered on the bar in the roadmap view.
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

// Lookup helpers, used everywhere
const _byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

function makeStore() {
  // Deep-clone so each artboard owns its mutable copy.
  return {
    platforms: JSON.parse(JSON.stringify(PLATFORMS)),
    statuses:  JSON.parse(JSON.stringify(STATUSES)),
    technologies: JSON.parse(JSON.stringify(TECHNOLOGIES)),
    initiatives:  JSON.parse(JSON.stringify(INITIATIVES)),
    businessUnits: JSON.parse(JSON.stringify(BUSINESS_UNITS)),
  };
}

// Count how many initiatives use a given tech, optionally scoped.
function techUsage(initiatives, techId, scope = null) {
  return initiatives.filter((i) =>
    (!scope || i.platformId === scope) && i.techIds.includes(techId)
  );
}

// Technologies that show up in 2+ initiatives — the "synergy" set.
function sharedTechIds(initiatives) {
  const counts = {};
  for (const i of initiatives) for (const t of i.techIds) counts[t] = (counts[t] || 0) + 1;
  return Object.keys(counts).filter((k) => counts[k] > 1);
}

Object.assign(window, {
  PLATFORMS, STATUSES, TECHNOLOGIES, INITIATIVES, BUSINESS_UNITS,
  makeStore, techUsage, sharedTechIds, _byId,
});
