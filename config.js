// Where the board reads and saves data.json.
// THIS COPY = development: points at Johan-BC test data (fictional initiatives).
// Production (nuuday/ai-board) has its own config.js — never copy this file
// there. See UDVIKLING.md.
window.AIBOARD_CONFIG = {
  // The board's own repo, 'owner/repo'. Leave blank to auto-detect from an
  // <owner>.github.io/<repo>/ Pages URL. Set it explicitly for private Pages
  // (*.pages.github.io), GitHub Enterprise Server or a custom domain.
  repo: 'Johan-BC/AI_Board',

  // Private repo that holds data.json, e.g. 'yousee/ai-board-data'.
  // Set → "link mode": the board shows nothing without a view/edit link, and
  //       editors need no GitHub account (the link carries the token).
  // Blank → data.json lives in the board repo itself and is public.
  dataRepo: 'Johan-BC/AI_Board-testdata',

  branch: 'main',
  file: 'data.json',

  // Who users should ask for a (new) link — shown when a link is missing/expired.
  contact: 'Johan',

  // GitHub Enterprise Server: 'https://github.yourcompany.com/api/v3'
  // GitHub Enterprise Cloud with data residency: 'https://api.yourcompany.ghe.com'
  apiBase: 'https://api.github.com',
};
