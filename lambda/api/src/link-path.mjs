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
