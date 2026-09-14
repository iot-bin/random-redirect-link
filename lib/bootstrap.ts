import 'server-only';
import { AuthError } from './auth-error';

export function getManagementApiUrl(): string {
  try {
    const url = new URL(process.env.MANAGEMENT_API_URL?.trim() ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
    return url.toString().replace(/\/+$/, '');
  } catch { throw new AuthError('CONFIG_ERROR', 503); }
}

type PublicConfiguration = {
  region: string; cognitoClientId: string; title: string; description: string;
};
// Per-instance cache: no credentials, cached failures or stale fallback.
let cached: { url: string; expires: number; value: PublicConfiguration } | undefined;
let pending: { url: string; promise: Promise<PublicConfiguration> } | undefined;

export async function getPublicConfiguration(): Promise<PublicConfiguration> {
  const url = getManagementApiUrl();
  if (cached?.url === url && cached.expires > Date.now()) return cached.value;
  if (pending?.url === url) return pending.promise;
  const promise = (async () => {
    let data: unknown;
    try {
      const response = await fetch(url + '/public/site', {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error();
      data = await response.json();
    } catch { throw new AuthError('CONTROL_UNAVAILABLE', 503); }
    if (!data || typeof data !== 'object') throw new AuthError('CONFIG_ERROR', 503);
    const value = data as Record<string, unknown>;
    if (typeof value.region !== 'string' || !/^[a-z]{2}-[a-z]+-\d$/.test(value.region)
      || typeof value.cognitoClientId !== 'string' || !/^[a-zA-Z0-9]{1,128}$/.test(value.cognitoClientId)) {
      throw new AuthError('CONFIG_ERROR', 503);
    }
    const config = {
      region: value.region, cognitoClientId: value.cognitoClientId,
      title: typeof value.title === 'string' ? value.title : '',
      description: typeof value.description === 'string' ? value.description : '',
    };
    cached = { url, value: config, expires: Date.now() + 60_000 };
    return config;
  })();
  pending = { url, promise };
  try { return await promise; }
  finally { if (pending?.promise === promise) pending = undefined; }
}
