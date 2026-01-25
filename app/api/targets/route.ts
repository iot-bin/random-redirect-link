import { NextResponse } from 'next/server';
import { getApiTargetsArray } from '@/lib/api-targets';

// GET endpoint to return available API targets
export async function GET() {
  try {
    const targets = getApiTargetsArray();
    
    // Don't expose baseUrl to client, only alias and label
    const clientTargets = targets.map(t => ({
      alias: t.alias,
      label: t.label || t.alias,
    }));
    
    return NextResponse.json({ targets: clientTargets });
  } catch (error) {
    console.error('Failed to get API targets:', error);
    return NextResponse.json(
      { error: 'Failed to load API targets' },
      { status: 500 }
    );
  }
}
