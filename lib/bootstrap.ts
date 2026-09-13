import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import defaults from '@/config/bootstrap.json';
function loadConfiguration(): typeof defaults {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'config/bootstrap.local.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaults;
    throw error;
  }
}
// Deployment coordinates stay in an ignored local file, never in source control.
export const bootstrap = loadConfiguration();
export function isConfigured() {
  try {
    const u = new URL(bootstrap.managementApiUrl);
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash
      && /^[a-zA-Z0-9]+$/.test(bootstrap.cognitoClientId) && /^[a-z]{2}-[a-z]+-\d$/.test(bootstrap.region);
  } catch { return false; }
}
