import 'server-only';

import { NextResponse } from 'next/server';
import { getApiTargetById } from '@/lib/api-targets';

type AdminMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type AdminOperation = 'list' | 'get' | 'create' | 'update' | 'delete' | 'batch';

interface AdminRequestOptions {
  targetId: string;
  endpoint: string;
  method: AdminMethod;
  body?: unknown;
  operation?: AdminOperation;
}

const REQUEST_TIMEOUT_MS = 10_000;

function errorResponse(status: number, error: string, code: string) {
  return NextResponse.json(
    { error, code },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

function getUpstreamString(payload: unknown, key: string): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function translateUpstreamError(
  status: number,
  payload: unknown,
  operation?: AdminOperation,
) {
  const upstreamError = getUpstreamString(payload, 'error');
  const upstreamCode = getUpstreamString(payload, 'code');

  if (status === 401 || status === 403) {
    return errorResponse(502, '后台管理令牌无效，请检查运行环境配置', 'UPSTREAM_AUTH_FAILED');
  }
  if (upstreamCode === 'INVALID_CURSOR') {
    return errorResponse(400, '分页信息已失效，请刷新列表', 'INVALID_CURSOR');
  }
  if (upstreamCode === 'INVALID_LIMIT') {
    return errorResponse(400, '每页数量必须是 1 至 100 的整数', 'INVALID_LIMIT');
  }
  if (upstreamCode === 'INVALID_PREFIX') {
    return errorResponse(400, '路径前缀无效，请检查后重试', 'INVALID_PREFIX');
  }
  if (upstreamCode === 'LIST_INDEX_UNAVAILABLE') {
    return errorResponse(503, '链接列表索引尚未就绪，请稍后重试', 'LIST_INDEX_UNAVAILABLE');
  }
  if (upstreamCode === 'LINK_VERSION_CONFLICT') {
    return errorResponse(409, '链接已被其他操作更新，请刷新后重试', 'LINK_VERSION_CONFLICT');
  }
  if (operation === 'list' && status === 404) {
    return errorResponse(501, '当前环境尚未启用链接列表接口', 'LIST_NOT_SUPPORTED');
  }
  if (status === 404 || upstreamError === 'not found') {
    return errorResponse(404, '未找到该短链', 'LINK_NOT_FOUND');
  }
  if (status === 409 || upstreamError === 'path already exists') {
    return errorResponse(409, '该短链路径已存在', 'LINK_CONFLICT');
  }
  if (status === 429 || status === 503) {
    return errorResponse(503, '后台服务暂时繁忙，请稍后重试', 'UPSTREAM_THROTTLED');
  }
  if (status >= 500) {
    return errorResponse(502, '后台服务处理失败，请稍后重试', 'UPSTREAM_ERROR');
  }

  return errorResponse(
    status,
    upstreamError || '请求未能完成',
    upstreamCode || 'UPSTREAM_REJECTED',
  );
}

export async function forwardAdminRequest({
  targetId,
  endpoint,
  method,
  body,
  operation,
}: AdminRequestOptions) {
  const normalizedTargetId = String(targetId ?? '').trim();
  if (!normalizedTargetId) {
    return errorResponse(400, '请选择运行环境', 'TARGET_REQUIRED');
  }

  const target = getApiTargetById(normalizedTargetId);
  if (!target) {
    return errorResponse(400, '所选运行环境不存在或配置无效', 'TARGET_NOT_FOUND');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(
      `${target.apiBaseUrl.replace(/\/+$/, '')}${endpoint}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target.adminToken}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      },
    );

    const text = await upstream.text();
    let payload: unknown = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }
    }

    if (!upstream.ok) {
      return translateUpstreamError(upstream.status, payload, operation);
    }

    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return errorResponse(504, '后台服务响应超时，请稍后重试', 'UPSTREAM_TIMEOUT');
    }
    return errorResponse(502, '无法连接后台服务，请稍后重试', 'UPSTREAM_UNAVAILABLE');
  } finally {
    clearTimeout(timeoutId);
  }
}
