import { NextResponse } from 'next/server';
import { getApiTargetById } from '@/lib/api-targets';

function normalizePath(input: string): string {
    // English comments: normalize and validate path
    const s = (input || '').trim();
    const noLeading = s.startsWith('/') ? s.slice(1) : s;
    const noTrailing = noLeading.replace(/\/+$/, '');
    return noTrailing;
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const targetId = String(body?.targetId ?? '').trim();
    
    // Get the API target configuration based on targetId
    if (!targetId) {
        return NextResponse.json(
            { error: 'targetId is required' },
            { status: 400 }
        );
    }

    const target = getApiTargetById(targetId);
    if (!target) {
        return NextResponse.json(
            { error: `Invalid targetId: ${targetId}. Target not found in API_TARGETS configuration.` },
            { status: 400 }
        );
    }

    const path = normalizePath(String(body?.path ?? ''));
    const targetUrl = String(body?.targetUrl ?? '').trim();

    // New fields for random subdomain redirect
    const randomSubdomain = Boolean(body?.randomSubdomain);
    const subdomainLengthRaw = Number(body?.subdomainLength ?? 10);
    const subdomainLength = Number.isFinite(subdomainLengthRaw) ? subdomainLengthRaw : 10;

    if (!path) {
        return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }
    if (!(targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
        return NextResponse.json({ error: 'targetUrl must start with http(s)://' }, { status: 400 });
    }
    if (randomSubdomain) {
        if (subdomainLength < 3 || subdomainLength > 32) {
            return NextResponse.json({ error: 'subdomainLength must be between 3 and 32' }, { status: 400 });
        }
    }

    // Forward request to the selected AWS Admin API
    const upstream = await fetch(`${target.apiBaseUrl}/links`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // English comments: keep token on server side only
            'Authorization': `Bearer ${target.adminToken}`,
        },
        body: JSON.stringify({
            path,
            targetUrl,
            randomSubdomain,
            subdomainLength,
        }),
        // Avoid caching for admin operations
        cache: 'no-store',
    });

    const text = await upstream.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    return NextResponse.json(json, { status: upstream.status });
}