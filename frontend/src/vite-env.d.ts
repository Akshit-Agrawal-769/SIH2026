/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the public API (gateway or data-service), e.g. https://incois-gateway.onrender.com. Empty = same origin. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
