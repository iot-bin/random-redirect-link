import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function withSecurityHeaders(response: NextResponse, contentSecurityPolicy: string) {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

const PUBLIC_ASSET_PATHS = new Set(['/site.webmanifest', '/logo.webp']);

function isPublicAsset(pathname: string): boolean {
  return (
    PUBLIC_ASSET_PATHS.has(pathname)
    || pathname.startsWith('/favicon')
    || pathname.startsWith('/apple-touch-icon')
    || pathname.startsWith('/android-chrome-')
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = crypto.randomUUID();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  const continueRequest = () => NextResponse.next({ request: { headers: requestHeaders } });
  const secureResponse = (response: NextResponse) =>
    withSecurityHeaders(response, contentSecurityPolicy);

  // All browser mutations must originate from this host, including login/logout.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (request.headers.get('origin') !== request.nextUrl.origin) {
      return secureResponse(
        NextResponse.json({ code: 'INVALID_ORIGIN', error: 'Invalid origin' }, { status: 403 }),
      );
    }
  }
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return secureResponse(continueRequest());
  }

  if (pathname.startsWith('/_next') || isPublicAsset(pathname)) {
    return secureResponse(continueRequest());
  }

  // Optimistic navigation guard only. AWS verifies the token and authorization.
  const hasSession = request.cookies.has('console-access') || request.cookies.has('console-refresh');
  if (!hasSession) {
    if (pathname.startsWith('/api/')) {
      return secureResponse(
        NextResponse.json(
          { error: '登录状态已失效，请重新登录', code: 'SESSION_EXPIRED' },
          { status: 401 },
        ),
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', `${pathname}${request.nextUrl.search}`);
    return secureResponse(NextResponse.redirect(loginUrl));
  }

  return secureResponse(continueRequest());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
