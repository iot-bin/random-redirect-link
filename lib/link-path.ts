export const MAX_LINK_PATH_LENGTH = 128;

export function normalizeLinkPath(input: string): string {
  return String(input ?? '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function getLinkPathError(input: string): string {
  const path = normalizeLinkPath(input);

  if (!path) return '请输入短链路径';
  if (path.length > MAX_LINK_PATH_LENGTH) {
    return '短链路径不能超过 128 个字符';
  }
  if (path.includes('..')) return '短链路径不能包含“..”';
  if (path.includes('//')) return '短链路径不能包含连续斜杠';
  if (path.includes('?') || path.includes('#')) {
    return '短链路径不能包含问号或井号';
  }

  return '';
}

export function encodeLinkPath(input: string): string {
  return normalizeLinkPath(input)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildShortUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const encodedPath = encodeLinkPath(path);
  return base && encodedPath ? `${base}/${encodedPath}` : '';
}

export function getLinkTarget(record: {
  targetUrl?: string;
  targetBaseUrl?: string;
  targetPath?: string;
}): string {
  if (record.targetUrl) return record.targetUrl;
  return `${record.targetBaseUrl ?? ''}${record.targetPath ?? ''}`;
}
