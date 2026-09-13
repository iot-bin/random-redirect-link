import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
const signer = new SignatureV4({ credentials: fromNodeProviderChain(), region: process.env.AWS_REGION, service: 'execute-api', sha256: Sha256 });
export async function callUpstream(target, path, method, query, body) {
  // Only allowlisted API IDs reach this function; never sign an arbitrary URL.
  const hostname = target.apiId + '.execute-api.' + process.env.AWS_REGION + '.amazonaws.com';
  const pathname = (target.stage === '$default' ? '' : '/' + target.stage) + path;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const signed = await signer.sign({ protocol: 'https:', hostname, method, path: pathname, query,
    headers: { host: hostname, 'content-type': 'application/json' }, body: payload });
  const suffix = new URLSearchParams(query).toString();
  const r = await fetch('https://' + hostname + pathname + (suffix ? '?' + suffix : ''), {
    method, headers: signed.headers, body: payload, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if ([401, 403].includes(r.status)) { await r.body?.cancel(); return { statusCode: 502, payload: { code: 'BACKEND_AUTH_FAILED', error: 'Backend IAM authorization failed' } }; }
  const response = await r.json();
  return { statusCode: r.status, payload: response };
}
