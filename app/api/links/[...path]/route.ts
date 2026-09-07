import { NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/admin-api';
import {
  encodeLinkPath,
  getLinkPathError,
  normalizeLinkPath,
} from '@/lib/link-path';
import {
  getSubdomainLengthError,
  getTargetUrlError,
} from '@/lib/link-validation';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

function errorResponse(error: string) {
  return NextResponse.json(
    { error, code: 'INVALID_PATH' },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function handleRequest(
  request: Request,
  context: RouteContext,
  method: 'GET' | 'DELETE',
) {
  const params = await context.params;
  const path = normalizeLinkPath(params.path.join('/'));
  const pathError = getLinkPathError(path);

  if (pathError) return errorResponse(pathError);

  const targetId = new URL(request.url).searchParams.get('targetId') ?? '';
  return forwardAdminRequest({
    targetId,
    endpoint: `/links/${encodeLinkPath(path)}`,
    method,
    operation: method === 'GET' ? 'get' : 'delete',
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = normalizeLinkPath(params.path.join('/'));
  const pathError = getLinkPathError(path);

  if (pathError) return errorResponse(pathError);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: '请求内容不是有效的 JSON', code: 'INVALID_JSON' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const values = body as Record<string, unknown>;
  const targetId = typeof values.targetId === 'string' ? values.targetId.trim() : '';
  const update: Record<string, unknown> = Object.fromEntries(
    ['startsAt', 'expiresAt', 'restore'].filter(key => key in values).map(key => [key, values[key]]),
  );

  if ('enabled' in values) {
    if (typeof values.enabled !== 'boolean') {
      return NextResponse.json(
        { error: '启用状态必须是布尔值', code: 'INVALID_ENABLED' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    update.enabled = values.enabled;
  }

  if ('targetUrl' in values) {
    const targetUrl = typeof values.targetUrl === 'string'
      ? values.targetUrl.trim()
      : '';
    const targetUrlError = getTargetUrlError(targetUrl);
    if (targetUrlError) {
      return NextResponse.json(
        { error: targetUrlError, code: 'INVALID_TARGET_URL' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    update.targetUrl = targetUrl;
  }

  if ('statusCode' in values) {
    if (values.statusCode !== 301 && values.statusCode !== 302) {
      return NextResponse.json(
        { error: '跳转状态码必须是 301 或 302', code: 'INVALID_STATUS_CODE' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    update.statusCode = values.statusCode;
  }

  if ('subdomainLength' in values) {
    const subdomainLength = typeof values.subdomainLength === 'number'
      ? values.subdomainLength
      : Number.NaN;
    const subdomainLengthError = getSubdomainLengthError(subdomainLength);
    if (subdomainLengthError) {
      return NextResponse.json(
        { error: subdomainLengthError, code: 'INVALID_SUBDOMAIN_LENGTH' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    update.subdomainLength = subdomainLength;
  }

  if ('expectedUpdatedAt' in values) {
    if (typeof values.expectedUpdatedAt !== 'string' || !values.expectedUpdatedAt) {
      return NextResponse.json(
        { error: '更新时间版本信息无效', code: 'INVALID_UPDATED_AT' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    update.expectedUpdatedAt = values.expectedUpdatedAt;
  }

  if (Object.keys(update).filter((key) => key !== 'expectedUpdatedAt').length === 0) {
    return NextResponse.json(
      { error: '没有可更新的字段', code: 'EMPTY_UPDATE' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return forwardAdminRequest({
    targetId,
    endpoint: `/links/${encodeLinkPath(path)}`,
    method: 'PATCH',
    operation: 'update',
    body: update,
  });
}

export function GET(request: Request, context: RouteContext) {
  return handleRequest(request, context, 'GET');
}

export function DELETE(request: Request, context: RouteContext) {
  return handleRequest(request, context, 'DELETE');
}
