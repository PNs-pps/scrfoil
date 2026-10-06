/// <reference types="vite/client" />

// Vite exposes build-time config through `import.meta.env`. Only `VITE_`-prefixed
// vars are included, and they are inlined into the client bundle at build time —
// so anything placed here is PUBLIC, not a secret, and should never hold a
// credential that matters. The operator password is a shared-device UX gate
// (see OPERATOR_PASSWORD in src/utils/auth.ts) and lives in source by choice.
interface ImportMetaEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}