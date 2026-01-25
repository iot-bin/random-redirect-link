import { NextResponse } from 'next/server';
import { getApiTarget, getApiTargets } from '@/lib/api-targets';

function normalizePath(input: string): string {
    // English comments: normalize and validate path
    const s = (input || '').trim();
    const noLeading = s.startsWith('/') ? s.slice(1) : s;
    const noTrailing = noLeading.replace(/\/+$/, '');
    return noTrailing;
}

export async function POST(req: Request) {
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;   // secret token

    if (!ADMIN_TOKEN) {
        return NextResponse.json(
            { error: 'Server is not configured (missing ADMIN_TOKEN).' },
            { status: 500 }
        );
    }

    const body = await req.json().catch(() => ({}));
    const path = normalizePath(String(body?.path ?? ''));
    const targetUrl = String(body?.targetUrl ?? '').trim();
    const apiTarget = String(body?.apiTarget ?? '').trim();

    if (!path) {
        return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }
    if (!(targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
        return NextResponse.json({ error: 'targetUrl must start with http(s)://' }, { status: 400 });
    }

    // Determine which API target to use
    const targets = getApiTargets();
    
    if (targets.size === 0) {
        return NextResponse.json(
            { error: 'Server is not configured (no API targets available).' },
            { status: 500 }
        );
    }

    let apiBaseUrl: string;
    
    if (apiTarget) {
        // Whitelist validation: only allow configured aliases
        const target = getApiTarget(apiTarget);
        if (!target) {
            return NextResponse.json(
                { error: 'Invalid apiTarget. Must be one of the configured aliases.' },
                { status: 400 }
            );
        }
        apiBaseUrl = target.baseUrl;
    } else {
        // No apiTarget specified: use first available target (backward compatibility)
        const firstTarget = Array.from(targets.values())[0];
        apiBaseUrl = firstTarget.baseUrl;
    }

    // Forward request to selected Admin API
    const upstream = await fetch(`${apiBaseUrl}/links`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // English comments: keep token on server side only
            'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ path, targetUrl }),
        // Avoid caching for admin operations
        cache: 'no-store',
    });

    const text = await upstream.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    return NextResponse.json(json, { status: upstream.status });
}