import { NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/admin-api';
import {
  getLinkPathError,
  getLinkPrefixError,
  normalizeLinkPath,
  normalizeLinkPrefix,
} from '@/lib/link-path';

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const MAX_CURSOR_LENGTH = 2048;

function errorResponse(error: string, code: string) {
  return NextResponse.json(
    { error, code },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

function getTargetUrlError(value: string): string {
  if (!value) return '请输入目标地址';

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return '目标地址必须以 http:// 或 https:// 开头';
    }
    if (url.search || url.hash) {
      return '当前后台暂不支持目标地址中的查询参数或锚点';
    }
  } catch {
    return '请输入有效的目标地址';
  }

  return '';
}

function parseListLimit(value: string | null): number | null {
  if (value === null || value === '') return DEFAULT_LIST_LIMIT;
  if (!/^\d+$/.test(value)) return null;

  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= MAX_LIST_LIMIT
    ? limit
    : null;
}

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const targetId = searchParams.get('targetId')?.trim() ?? '';
  const limit = parseListLimit(searchParams.get('limit'));
  const cursor = searchParams.get('cursor')?.trim() ?? '';
  const rawPrefix = searchParams.get('prefix') ?? '';
  const prefix = normalizeLinkPrefix(rawPrefix);

  if (limit === null) {
    return errorResponse('每页数量必须是 1 至 100 的整数', 'INVALID_LIMIT');
  }

  if (
    cursor.length > MAX_CURSOR_LENGTH
    || (cursor && !/^[A-Za-z0-9_-]+$/.test(cursor))
  ) {
    return errorResponse('分页信息无效，请刷新列表', 'INVALID_CURSOR');
  }

  if (prefix) {
    const prefixError = getLinkPrefixError(prefix);
    if (prefixError) return errorResponse(prefixError, 'INVALID_PREFIX');
  }

  const upstreamQuery = new URLSearchParams({ limit: String(limit) });
  if (cursor) upstreamQuery.set('cursor', cursor);
  if (prefix) upstreamQuery.set('prefix', prefix);

  return forwardAdminRequest({
    targetId,
    endpoint: `/links?${upstreamQuery.toString()}`,
    method: 'GET',
    operation: 'list',
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse('请求内容不是有效的 JSON', 'INVALID_JSON');
  }

  const values = body as Record<string, unknown>;
  const targetId = typeof values.targetId === 'string' ? values.targetId.trim() : '';
  const path = typeof values.path === 'string' ? normalizeLinkPath(values.path) : '';
  const targetUrl = typeof values.targetUrl === 'string' ? values.targetUrl.trim() : '';
  const randomSubdomain = values.randomSubdomain === true;
  const subdomainLength = typeof values.subdomainLength === 'number'
    ? values.subdomainLength
    : Number.NaN;

  const pathError = getLinkPathError(path);
  if (pathError) return errorResponse(pathError, 'INVALID_PATH');

  const targetUrlError = getTargetUrlError(targetUrl);
  if (targetUrlError) return errorResponse(targetUrlError, 'INVALID_TARGET_URL');

  if (!randomSubdomain) {
    return errorResponse(
      '当前后台暂不支持固定地址模式，请启用随机二级域名',
      'FIXED_MODE_UNAVAILABLE',
    );
  }

  if (
    !Number.isInteger(subdomainLength)
    || subdomainLength < 3
    || subdomainLength > 32
  ) {
    return errorResponse('随机字符长度必须是 3 至 32 的整数', 'INVALID_SUBDOMAIN_LENGTH');
  }

  return forwardAdminRequest({
    targetId,
    endpoint: '/links',
    method: 'POST',
    operation: 'create',
    body: {
      path,
      targetUrl,
      randomSubdomain,
      subdomainLength,
    },
  });
}
