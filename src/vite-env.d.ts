/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXPLAIN_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
