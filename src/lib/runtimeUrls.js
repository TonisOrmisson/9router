function trimTrailingSlash(url) {
  return typeof url === "string" ? url.replace(/\/+$/, "") : "";
}

export function getRequestOrigin(request) {
  return trimTrailingSlash(new URL(request.url).origin);
}

export function getInternalBaseUrl(request) {
  const configuredBaseUrl =
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;

  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  return getRequestOrigin(request);
}
