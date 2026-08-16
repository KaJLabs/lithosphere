// Process entrypoint: load mounted VPS/Docker secrets, THEN start the app.
//
// The top-level await below fully resolves before the dynamic import() of
// index.js runs, so index.js's whole static graph (incl. config.js) evaluates
// only after the secrets are in process.env. This ordering guarantee is why the
// secret fetch lives here rather than as a static import inside index.js — see
// the note in preload.js.
import { loadSecrets } from './preload.js';

await loadSecrets();
await import('./index.js');
