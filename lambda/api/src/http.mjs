const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
  "Content-Type": "text/plain; charset=utf-8"
};

export function text(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...NO_CACHE_HEADERS,
      ...extraHeaders
    },
    body
  };
}

export function redirect(statusCode, location, { headRequest = false } = {}) {
  return text(
    statusCode,
    headRequest ? "" : `Redirecting to ${location}`,
    { Location: location }
  );
}
