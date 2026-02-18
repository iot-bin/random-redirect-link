import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow login page and API routes
    if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
        return NextResponse.next();
    }

    // Allow static files
    if (pathname.startsWith('/_next') || 
        pathname.startsWith('/favicon') || 
        pathname.startsWith('/logo.') ||
        pathname.startsWith('/apple-touch-icon') ||
        pathname.startsWith('/android-chrome-') ||
        pathname.startsWith('/site.webmanifest') ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)) {
        return NextResponse.next();
    }

    // Check for session cookie
    const session = request.cookies.get('session');

    if (!session || session.value !== 'authenticated') {
        // Redirect to login page
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         */
        '/((?!_next/static|_next/image).*)',
    ],
};
