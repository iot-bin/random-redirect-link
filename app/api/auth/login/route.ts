import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  createSessionToken,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/session';

export async function POST(request: Request) {
  const consolePassword = process.env.CONSOLE_PASSWORD;
  if (!consolePassword) {
    return NextResponse.json(
      { error: '服务端尚未配置控制台密码' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '请求内容格式错误' }, { status: 400 });
  }

  const password = String((body as Record<string, unknown>).password ?? '');
  if (!password) {
    return NextResponse.json({ error: '请输入密码' }, { status: 400 });
  }
  if (password !== consolePassword) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const sessionToken = await createSessionToken(consolePassword);
  const cookieStore = await cookies();
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  return NextResponse.json({ success: true });
}
