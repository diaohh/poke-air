const isProduction = process.env.NODE_ENV === 'production';

function parseOrigins(raw: string | undefined): string[] | true {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) {
    // Phones on the LAN load the web app from http://<lan-ip>:5173, so dev must accept any origin.
    if (isProduction) throw new Error('ALLOWED_ORIGINS must be set explicitly in production');
    return true;
  }
  return origins;
}

export interface Config {
  isProduction: boolean;
  port: number;
  host: string;
  /** `true` reflects any origin (development only). */
  allowedOrigins: string[] | true;
  logLevel: string;
  roomSweepIntervalMs: number;
}

export const config: Config = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  roomSweepIntervalMs: 60_000,
};
