/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FLEETLEDGER: string;
  readonly VITE_MONAD_RPC_URL: string;
  readonly VITE_MONAD_EXPLORER: string;
  readonly VITE_POOL_ID: string;
  readonly VITE_SEAT_ID: string;
  readonly VITE_SEAT_B_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
