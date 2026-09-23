import { MAX_LINK_PATH_LENGTH, normalizeLinkPath, normalizeLinkPrefix, linkPathIssue } from '../packages/contracts/index.mjs';

export { MAX_LINK_PATH_LENGTH, normalizeLinkPath, normalizeLinkPrefix };

const pathMessages = {
  required: '请输入短链路径',
  length: '短链路径不能超过 128 个字符',
  dot_segments: '短链路径不能包含“..”',
  double_slash: '短链路径不能包含连续斜杠',
  query_fragment: '短链路径不能包含问号或井号',
};
const prefixMessages = {
  required: '',
  length: '路径前缀不能超过 128 个字符',
  dot_segments: '路径前缀不能包含“..”',
  double_slash: '路径前缀不能包含连续斜杠',
  query_fragment: '路径前缀不能包含问号或井号',
};

export function getLinkPathError(input: string): string {
  const issue = linkPathIssue(input);
  return issue ? pathMessages[issue] : '';
}

export function getLinkPrefixError(input: string): string {
  const issue = linkPathIssue(input, { prefix: true });
  return issue ? prefixMessages[issue] : '';
}

export function encodeLinkPath(input: string): string {
  return normalizeLinkPath(input).split('/').map(encodeURIComponent).join('/');
}

export function buildShortUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const encodedPath = encodeLinkPath(path);
  return base && encodedPath ? `${base}/${encodedPath}` : '';
}

export function getLinkTarget(record: { targetUrl?: string; targetBaseUrl?: string; targetPath?: string }): string {
  return record.targetUrl || `${record.targetBaseUrl ?? ''}${record.targetPath ?? ''}`;
}
