/**
 * Public identity catalog API. Consumers should import from `@/data/identity`
 * only, not from `catalog.ts` or per-dataset modules.
 */

export type {
  FrontendTerminalSnapshot,
  FrontendTerminalsTopologySnapshot,
  FrontendVesselSnapshot,
  IdentityCatalogState,
} from "./catalog";
export {
  IDENTITY_TERMINALS_ASSET,
  IDENTITY_TERMINALS_STORAGE_KEY,
  IDENTITY_TERMINALS_TOPOLOGY_ASSET,
  IDENTITY_TERMINALS_TOPOLOGY_STORAGE_KEY,
  IDENTITY_VESSELS_ASSET,
  IDENTITY_VESSELS_STORAGE_KEY,
  readIdentityCatalog,
  replaceIdentityCatalogSnapshots,
  subscribeIdentityCatalog,
} from "./catalog";
