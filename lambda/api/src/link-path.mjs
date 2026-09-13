export function normalizePath(rawPath) {
  const trimmed = String(rawPath ?? "").trim();
  const withoutLeadingSlash = trimmed.startsWith("/")
    ? trimmed.slice(1)
    : trimmed;

  let decoded = withoutLeadingSlash;
  try {
    decoded = decodeURIComponent(withoutLeadingSlash);
  } catch {
    // Keep the original value so malformed encodings simply miss the lookup.
  }

  return decoded.replace(/\/+$/, "");
}
// Named stages appear in rawPath on the execute-api endpoint, but not in custom-domain mappings.
export function requestPath(event) {
  const raw = event?.rawPath ?? event?.path ?? '/';
  const context = event?.requestContext;
  const stage = context?.stage;
  const directEndpoint = /^[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/.test(context?.domainName ?? '');
  if (event?.version === '2.0' && directEndpoint && stage && stage !== '$default') {
    const prefix = '/' + stage;
    if (raw === prefix) return '/';
    if (raw.startsWith(prefix + '/')) return raw.slice(prefix.length);
  }
  return raw;
}
