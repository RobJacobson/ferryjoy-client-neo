/**
 * Barrel for orchestrator identity snapshot loading.
 *
 * Runs before the WSF fetch; see `VesselOrchestratorPipeline.md` (load
 * identity read model).
 */

export {
  loadSnapshot as loadOrchestratorSnapshot,
  type OrchestratorSnapshot,
} from "./loadSnapshot";
