import type { PublicApiTarget } from '@/lib/link-types';

export interface ApiTarget extends PublicApiTarget {
  apiBaseUrl: string;
  adminToken: string;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parseApiTargets(): ApiTarget[] {
  const targetsJson = process.env.API_TARGETS;
  if (!targetsJson) return [];

  try {
    const parsed: unknown = JSON.parse(targetsJson);
    if (!Array.isArray(parsed)) {
      console.error('API_TARGETS 必须是 JSON 数组');
      return [];
    }

    return parsed.flatMap((target, index) => {
      if (typeof target !== 'object' || target === null) {
        console.warn(`API_TARGETS 第 ${index + 1} 项格式无效，已忽略`);
        return [];
      }

      const value = target as Record<string, unknown>;
      const id = typeof value.id === 'string' ? value.id.trim() : '';
      const name = typeof value.name === 'string' ? value.name.trim() : '';
      const apiBaseUrl = isHttpUrl(value.apiBaseUrl)
        ? value.apiBaseUrl.replace(/\/+$/, '')
        : '';
      const adminToken = typeof value.adminToken === 'string'
        ? value.adminToken
        : '';
      const redirectBaseUrl = isHttpUrl(value.redirectBaseUrl)
        ? value.redirectBaseUrl.replace(/\/+$/, '')
        : '';

      const valid =
        id.length > 0
        && name.length > 0
        && apiBaseUrl.length > 0
        && adminToken.length > 0
        && redirectBaseUrl.length > 0;

      if (!valid) {
        console.warn(`API_TARGETS 第 ${index + 1} 项配置不完整，已忽略`);
        return [];
      }

      return [{
        id,
        name,
        apiBaseUrl,
        adminToken,
        redirectBaseUrl,
      }];
    });
  } catch {
    console.error('无法解析 API_TARGETS，请检查 JSON 格式');
    return [];
  }
}

export function getPublicApiTargets(): PublicApiTarget[] {
  return parseApiTargets().map(({ id, name, redirectBaseUrl }) => ({
    id,
    name,
    redirectBaseUrl,
  }));
}

export function getApiTargetById(id: string): ApiTarget | null {
  return parseApiTargets().find((target) => target.id === id) ?? null;
}

export function getDefaultTargetId(): string | null {
  const targets = parseApiTargets();
  const configuredDefault = process.env.DEFAULT_TARGET_ID?.trim();

  if (configuredDefault && targets.some((target) => target.id === configuredDefault)) {
    return configuredDefault;
  }

  return targets[0]?.id ?? null;
}
