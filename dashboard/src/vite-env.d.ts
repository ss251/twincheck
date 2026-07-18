/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DONESTAMP: string;
  readonly VITE_FLEETLEDGER: string;
  readonly VITE_MONAD_RPC_URL: string;
  readonly VITE_MONAD_EXPLORER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
