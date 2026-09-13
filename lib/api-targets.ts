import 'server-only';
import { bootstrap,isConfigured } from './bootstrap';
export async function getSiteSettings(): Promise<{title?:string;description?:string}> {
  if (!isConfigured()) return {};
  try {
    const r = await fetch(bootstrap.managementApiUrl.replace(/\/+$/,'')+'/public/site',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(3000)});
    if (!r.ok) return {};
    const s = await r.json();
    return {title:typeof s.title==='string'?s.title:undefined,description:typeof s.description==='string'?s.description:undefined};
  } catch { return {}; }
}
