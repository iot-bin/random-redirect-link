import { NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/admin-api';
import { getLinkPathError, normalizeLinkPath } from '@/lib/link-path';
import type { LinkBatchAction } from '@/lib/link-types';

const MAX_BATCH_SIZE = 50;
const BATCH_ACTIONS = new Set<LinkBatchAction>(['enable', 'disable', 'delete', 'restore']);

function errorResponse(error: string, code: string) {
  return NextResponse.json(
    { error, code },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorResponse('请求内容不是有效的 JSON', 'INVALID_JSON');
  }

  const values = body as Record<string, unknown>;
  const targetId = typeof values.targetId === 'string' ? values.targetId.trim() : '';
  const action = typeof values.action === 'string'
    ? values.action as LinkBatchAction
    : null;

  if (!action || !BATCH_ACTIONS.has(action)) {
    return errorResponse('批量操作类型无效', 'INVALID_BATCH_ACTION');
  }
  if (!Array.isArray(values.paths) || values.paths.length === 0) {
    return errorResponse('请至少选择一条短链', 'INVALID_PATHS');
  }
  if (values.paths.length > MAX_BATCH_SIZE) {
    return errorResponse(`每次最多操作 ${MAX_BATCH_SIZE} 条短链`, 'BATCH_LIMIT_EXCEEDED');
  }

  const paths: string[] = [];
  const seen = new Set<string>();

  for (const value of values.paths) {
    if (typeof value !== 'string') {
      return errorResponse('短链路径格式无效', 'INVALID_PATHS');
    }

    const path = normalizeLinkPath(value);
    const pathError = getLinkPathError(path);
    if (pathError) return errorResponse(pathError, 'INVALID_PATHS');

    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }

  return forwardAdminRequest({
    targetId,
    endpoint: '/links/batch',
    method: 'POST',
    operation: 'batch',
    body: { action, paths },
  });
}
