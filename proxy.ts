import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/session';

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

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.CONSOLE_PASSWORD;
  const sessionToken = request.cookies.get('session')?.value;
  const isAuthenticated =
    Boolean(secret)
    && Boolean(sessionToken)
    && await verifySessionToken(sessionToken ?? '', secret ?? '');

  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '登录状态已失效，请重新登录' }, { status: 401 });
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
