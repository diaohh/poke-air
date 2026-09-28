/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL. Empty → `<current hostname>:3001`. */
  readonly VITE_BACKEND_URL?: string;
  /** Public web URL encoded in the join QR. Empty → dev LAN address or current origin. */
  readonly VITE_PUBLIC_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
