/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TWINCHECK: string;
  readonly VITE_TWINCHECK_DEPLOY_BLOCK: string;
  readonly VITE_MONAD_RPC_URL: string;
  readonly VITE_MONAD_EXPLORER: string;
  readonly VITE_MONADSCAN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
