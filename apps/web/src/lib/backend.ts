/** Backend base URL: explicit env var, else same hostname on port 3001 (works on the LAN in dev). */
export function backendUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

/**
 * Fire-and-forget `GET /healthz` (decision D-66): the free backend sleeps after 15 idle minutes and
 * takes about a minute to wake, so every page load nudges it before any socket opens. Opaque
 * (`no-cors`): only the request matters, and failures are ignored.
 */
export function warmUpBackend(): void {
  void fetch(`${backendUrl()}/healthz`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Base URL encoded in the join QR. Phones can't open `localhost`, so in development we ask the
 * backend for the PC's LAN address and point the QR there.
 */
export async function resolvePublicAppUrl(): Promise<string> {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');

  const { hostname, origin, protocol, port } = window.location;
  if (!LOCAL_HOSTNAMES.has(hostname)) return origin;

  try {
    const response = await fetch(`${backendUrl()}/api/info`);
    const info = (await response.json()) as { lanAddresses?: string[] };
    const lanAddress = info.lanAddresses?.[0];
    if (lanAddress) return `${protocol}//${lanAddress}${port ? `:${port}` : ''}`;
  } catch {
    // Fall back to the current origin; the Host still works, phones just can't scan it.
  }
  return origin;
}

export function joinUrl(baseUrl: string, code: string): string {
  return `${baseUrl}/j/${code}`;
}
