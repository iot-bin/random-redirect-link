import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


const PUBLIC_ASSET_PATHS = new Set([
  '/site.webmanifest',
  '/logo.webp',
  '/file.svg',
  '/globe.svg',
  '/next.svg',
  '/vercel.svg',
  '/window.svg',
]);

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

  // All browser mutations must originate from this host, including login/logout.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (request.headers.get('origin') !== request.nextUrl.origin) {
      return NextResponse.json({ code: 'INVALID_ORIGIN', error: 'Invalid origin' }, { status: 403 });
    }
  }
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  // Optimistic navigation guard only. AWS verifies the token and authorization.
  const hasSession = request.cookies.has('console-access') || request.cookies.has('console-refresh');
  if (!hasSession) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: '登录状态已失效，请重新登录', code: 'SESSION_EXPIRED' },
        { status: 401 },
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
