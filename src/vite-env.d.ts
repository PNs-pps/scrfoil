/// <reference types="vite/client" />

// Vite exposes build-time config through `import.meta.env`. Only `VITE_`-prefixed
// vars are included, and they are inlined into the client bundle at build time —
// so anything placed here is PUBLIC, not a secret, and should never hold a
// credential that matters. The operator password is a shared-device UX gate
// (see src/utils/auth.ts). Prefer VITE_OPERATOR_PASSWORD at build time; the
// code falls back to a hardcoded default when this is unset.
interface ImportMetaEnv {
  readonly VITE_OPERATOR_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
