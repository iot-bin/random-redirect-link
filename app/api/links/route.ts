import { NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/admin-api';
import { getLinkPathError, normalizeLinkPath } from '@/lib/link-path';

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse('请求内容不是有效的 JSON', 'INVALID_JSON');
  }

  const values = body as Record<string, unknown>;
  const targetId = String(values.targetId ?? '').trim();
  const path = normalizeLinkPath(String(values.path ?? ''));
  const targetUrl = String(values.targetUrl ?? '').trim();
  const randomSubdomain = Boolean(values.randomSubdomain);
  const subdomainLength = Number(values.subdomainLength ?? 10);

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
    body: {
      path,
      targetUrl,
      randomSubdomain,
      subdomainLength,
    },
  });
}
