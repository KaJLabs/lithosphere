// Secret bootstrap — pulls sensitive material from AWS Secrets Manager into
// process.env so it never has to live in plaintext on disk
// (docker-compose.override.yml etc.). Only the AWS access keys need to be on the
// host; everything they unlock is fetched here.
//
// IMPORTANT: call loadSecrets() and AWAIT it BEFORE anything imports config.js.
// Static ESM imports do NOT guarantee a top-level-await module finishes before a
// sibling *synchronous* module's body runs, so config.js (which reads these vars
// at module-eval) must not be in the import graph until this has resolved. The
// entrypoint (entrypoint.mjs) awaits this, then dynamically imports the app.
//
// Opt-in per secret: set the *_SECRET id var. If the plaintext var is already
// set (local dev) or the id is absent, we leave things untouched — no behavior
// change, no hard AWS dependency.
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION || 'us-east-1';

async function getSecretJson(id) {
  const c = new SecretsManagerClient({ region: REGION });
  const r = await c.send(new GetSecretValueCommand({ SecretId: id }));
  return JSON.parse(r.SecretString);
}

// [ plaintext env var, *_SECRET id var, field(s) to read from the secret JSON ]
const MAPPINGS = [
  ['RELAYER_PRIVATE_KEY', 'RELAYER_KEY_SECRET', ['private_key', 'relayerPrivateKey', 'key']],
  ['AUTH_SESSION_SECRET', 'AUTH_SESSION_SECRET_ID', ['session_secret', 'secret', 'value']],
];

export async function loadSecrets() {
  for (const [plainVar, secretIdVar, fields] of MAPPINGS) {
    const secretId = process.env[secretIdVar];
    if (process.env[plainVar] || !secretId) continue; // already set, or nothing to fetch
    try {
      const json = await getSecretJson(secretId);
      const val = fields.map((f) => json[f]).find(Boolean);
      if (!val) throw new Error(`secret ${secretId} has none of fields [${fields.join(', ')}]`);
      process.env[plainVar] = val;
      console.log(`[preload] loaded ${plainVar} from Secrets Manager (${secretId})`);
    } catch (err) {
      console.error(`[preload] FAILED to load ${plainVar} from ${secretId}: ${err.message}`);
      // Fail fast: a bridge-api that silently starts with the release executor
      // disabled would strand cross-chain releases. Only fatal when opted-in.
      process.exit(1);
    }
  }
}
