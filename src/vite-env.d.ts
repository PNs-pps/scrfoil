/// <reference types="vite/client" />

// Vite exposes build-time config through `import.meta.env`. Only `VITE_`-prefixed
// vars are included, and they are inlined into the client bundle at build time —
// so anything placed here is PUBLIC, not a secret. `VITE_OPERATOR_PASSWORD` in
// src/utils/auth.ts is a shared-device UX gate, never an authorization boundary.
interface ImportMetaEnv {
  readonly VITE_OPERATOR_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}