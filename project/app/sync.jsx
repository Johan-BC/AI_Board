// GitHub sync — repo config, Contents API read/write, and a three-way merge so
// concurrent editors never overwrite each other's changes.
// Plain JS (no JSX) so it can be unit-tested in Node.

// ── Config ────────────────────────────────────────────────────────────────────
// Set in /config.js. A blank `repo` is auto-detected from an
// <owner>.github.io/<repo>/ Pages URL. With `dataRepo` set, data.json lives in
// that (private) repo and is only reachable with a token from a view/edit link.
function resolveSyncConfig() {
  const c = (typeof window !== 'undefined' && window.AIBOARD_CONFIG) || {};
  let boardRepo = (c.repo || '').trim();
  if (!boardRepo && typeof location !== 'undefined') {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    const seg = location.pathname.split('/').filter(Boolean)[0];
    if (m && seg) boardRepo = `${m[1]}/${seg}`;
  }
  const dataRepo = (c.dataRepo || '').trim();
  const apiBase = (c.apiBase || 'https://api.github.com').replace(/\/+$/, '');
  // Web host: api.github.com → github.com, GHE Server https://host/api/v3 →
  // https://host, ghe.com api.x.ghe.com → x.ghe.com
  const webBase = apiBase === 'https://api.github.com'
    ? 'https://github.com'
    : apiBase.replace(/\/api\/v3$/, '').replace('://api.', '://');
  return {
    repo: dataRepo || boardRepo || null,   // where data.json is read/written
    boardRepo: boardRepo || null,
    linkMode: !!dataRepo,                  // data only via view/edit links
    branch: c.branch || 'main',
    file: c.file || 'data.json',
    apiBase,
    webBase,
    tokenUrl: `${webBase}/settings/personal-access-tokens/new`,
    pollMs: c.pollMs || 30000,
    contact: c.contact || '',
  };
}

// A view/edit link carries its token in the URL fragment (never sent to the
// server). Returns { mode, token } and strips it from the address bar so it
// isn't copied along when someone shares the URL they're looking at.
function takeLinkToken() {
  if (typeof location === 'undefined') return null;
  const m = location.hash.match(/(?:^#|&)(view|edit)=([^&]+)/);
  if (!m) return null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
  return { mode: m[1], token: decodeURIComponent(m[2]) };
}

// ── GitHub Contents API ───────────────────────────────────────────────────────
function ghHeaders(pat) {
  return { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' };
}

// UTF-8 safe base64 encode/decode
function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function b64Decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function ghUrl(cfg) {
  return `${cfg.apiBase}/repos/${cfg.repo}/contents/${cfg.file}`;
}

async function readFromGitHub(cfg, pat) {
  const res = await fetch(`${ghUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`,
    { headers: ghHeaders(pat), cache: 'no-store' });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}`), { status: res.status });
  const { content, sha } = await res.json();
  return { store: parseJSON(b64Decode(content)), sha };
}

async function writeToGitHub(cfg, pat, store, sha, message) {
  const body = {
    message,
    content: b64Encode(JSON.stringify(store, null, 2)),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(ghUrl(cfg), {
    method: 'PUT',
    headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // 409 = sha is stale; 422 is also returned for a missing/mismatched sha
  if (res.status === 409 || res.status === 422) {
    throw Object.assign(new Error(`GitHub conflict ${res.status}`), { code: 'conflict', status: res.status });
  }
  if (!res.ok) throw Object.assign(new Error(`GitHub write ${res.status}`), { status: res.status });
  return (await res.json()).content.sha;
}

// ── Three-way merge ───────────────────────────────────────────────────────────
// merge3(base, local, remote): apply what changed locally since `base` on top of
// `remote`. Recurses into plain objects field by field; arrays of {id} objects
// are merged per entity; arrays of primitives as sets. When both sides changed
// the same scalar, local wins. An edit always beats a concurrent delete, so no
// one's work is silently dropped.
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k]));
}

const isPlainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isEntityArr = (v) => Array.isArray(v) && v.every((x) => isPlainObj(x) && x.id != null);
const isPrimArr = (v) => Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object');

function merge3(base, local, remote) {
  if (deepEq(local, base)) return remote;
  if (deepEq(remote, base) || deepEq(local, remote)) return local;
  // Both changed. Edit beats delete.
  if (local === undefined) return remote;
  if (remote === undefined) return local;

  if (isPlainObj(local) && isPlainObj(remote)) {
    const b = isPlainObj(base) ? base : {};
    const out = {};
    const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
    keys.forEach((k) => {
      const v = merge3(b[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    if (isEntityArr(local) && isEntityArr(remote) && isEntityArr(b)) {
      const byId = (arr) => new Map(arr.map((x) => [x.id, x]));
      const bm = byId(b), lm = byId(local), rm = byId(remote);
      const out = [];
      const seen = new Set();
      // Remote order first, then entities only local knows about
      [...remote, ...local].forEach(({ id }) => {
        if (seen.has(id)) return;
        seen.add(id);
        const v = merge3(bm.get(id), lm.get(id), rm.get(id));
        if (v !== undefined) out.push(v);
      });
      return out;
    }
    if (isPrimArr(local) && isPrimArr(remote) && isPrimArr(b)) {
      const added   = local.filter((x) => !b.includes(x));
      const removed = new Set(b.filter((x) => !local.includes(x)));
      const out = remote.filter((x) => !removed.has(x));
      added.forEach((x) => { if (!out.includes(x)) out.push(x); });
      return out;
    }
  }
  return local;
}

// ── Commit message ────────────────────────────────────────────────────────────
// Names the initiatives touched, so git history reads as an audit log.
function describeChange(base, next, who) {
  const bi = new Map(((base && base.initiatives) || []).map((i) => [i.id, i]));
  const ni = new Map(((next && next.initiatives) || []).map((i) => [i.id, i]));
  const parts = [];
  ni.forEach((i, id) => {
    if (!bi.has(id)) parts.push(`+ ${i.name || id}`);
    else if (!deepEq(bi.get(id), i)) parts.push(i.name || id);
  });
  bi.forEach((i, id) => { if (!ni.has(id)) parts.push(`− ${i.name || id}`); });
  const otherKeys = new Set([...Object.keys(base || {}), ...Object.keys(next || {})]);
  otherKeys.delete('initiatives');
  const catalogue = [...otherKeys].some((k) => !deepEq((base || {})[k], (next || {})[k]));

  let msg = who ? `board (${who}): ` : 'board: ';
  if (parts.length) {
    msg += parts.slice(0, 3).join(', ');
    if (parts.length > 3) msg += ` (+${parts.length - 3})`;
    if (catalogue) msg += ' + katalog';
  } else {
    msg += catalogue ? 'katalog' : 'save';
  }
  return msg.length > 120 ? msg.slice(0, 117) + '…' : msg;
}

if (typeof module !== 'undefined') module.exports = { merge3, deepEq, describeChange, resolveSyncConfig, takeLinkToken };
