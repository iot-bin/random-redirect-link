import { NextResponse } from 'next/server';
import { getPublicApiTargets, getDefaultTargetId } from '@/lib/api-targets';

/**
 * GET /api/targets
 * Returns the list of available API targets (without sensitive tokens)
 */
export async function GET() {
    const targets = getPublicApiTargets();
    const defaultTargetId = getDefaultTargetId();

    return NextResponse.json({
        targets,
        defaultTargetId,
    });
}
