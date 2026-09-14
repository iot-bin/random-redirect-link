import 'server-only';
import { getPublicConfiguration } from './bootstrap';
export async function getSiteSettings(): Promise<{title?:string;description?:string}> {
  try {
    const {title, description} = await getPublicConfiguration();
    return {title, description};
  } catch { return {}; }
}
