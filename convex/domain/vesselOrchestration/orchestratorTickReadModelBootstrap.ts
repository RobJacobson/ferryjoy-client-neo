/**
 * Pure policy for orchestrator tick read-model loading when identity tables may
 * be empty (bootstrap). Convex I/O stays in `functions/vesselOrchestrator`.
 */

/** Snapshot shape: vessel and terminal identity row counts only. */
export type OrchestratorTickIdentitySnapshot = {
  readonly vessels: readonly unknown[];
  readonly terminals: readonly unknown[];
};

/**
 * Error thrown when `vesselsIdentity` is still empty after a bootstrap refresh.
 */
export const ORCHESTRATOR_VESSELS_IDENTITY_STILL_EMPTY =
  "Backend vesselsIdentity table is still empty after bootstrap refresh.";

/**
 * Error thrown when `terminalsIdentity` is still empty after a bootstrap refresh.
 */
export const ORCHESTRATOR_TERMINALS_IDENTITY_STILL_EMPTY =
  "Backend terminalsIdentity table is still empty after bootstrap refresh.";

/**
 * Whether the vessels identity table needs a sync before this tick can proceed.
 *
 * @param snapshot - Latest orchestrator read-model snapshot
 * @returns True when there are no vessel identity rows
 */
export const vesselsIdentityNeedsBootstrap = (
  snapshot: OrchestratorTickIdentitySnapshot
): boolean => snapshot.vessels.length === 0;

/**
 * Whether the terminals identity table needs a sync before this tick can proceed.
 *
 * @param snapshot - Latest orchestrator read-model snapshot
 * @returns True when there are no terminal identity rows
 */
export const terminalsIdentityNeedsBootstrap = (
  snapshot: OrchestratorTickIdentitySnapshot
): boolean => snapshot.terminals.length === 0;

/**
 * Throws if either identity table is still empty after optional bootstrap syncs.
 *
 * @param snapshot - Read-model snapshot after any re-query
 */
export const assertOrchestratorIdentityReady = (
  snapshot: OrchestratorTickIdentitySnapshot
): void => {
  if (vesselsIdentityNeedsBootstrap(snapshot)) {
    throw new Error(ORCHESTRATOR_VESSELS_IDENTITY_STILL_EMPTY);
  }
  if (terminalsIdentityNeedsBootstrap(snapshot)) {
    throw new Error(ORCHESTRATOR_TERMINALS_IDENTITY_STILL_EMPTY);
  }
};
