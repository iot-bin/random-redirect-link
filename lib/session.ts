const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) return null;

  const bytes = new Uint8Array(new ArrayBuffer(value.length / 2));
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

async function importKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAt);
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${bytesToHex(signature)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<boolean> {
  const [payload, signatureHex, extra] = token.split('.');
  if (!payload || !signatureHex || extra) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const signature = hexToBytes(signatureHex);
  if (!signature) return false;

  const key = await importKey(secret);
  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    encoder.encode(payload),
  );
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;
