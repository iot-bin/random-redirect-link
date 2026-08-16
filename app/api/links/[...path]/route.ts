import { NextResponse } from 'next/server';
import { forwardAdminRequest } from '@/lib/admin-api';
import {
  encodeLinkPath,
  getLinkPathError,
  normalizeLinkPath,
} from '@/lib/link-path';

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
  });
}

export function GET(request: Request, context: RouteContext) {
  return handleRequest(request, context, 'GET');
}

export function DELETE(request: Request, context: RouteContext) {
  return handleRequest(request, context, 'DELETE');
}
