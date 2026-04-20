/**
 * Per-ping writes for timeline tables (`eventsActual`, `eventsPredicted`) produced
 * after lifecycle persistence. Peers apply these via orchestrator mutations.
 *
 * Canonical definitions live in `domain/vesselOrchestration/shared`.
 */

export {
  mergePingEventWrites,
  type PingEventWrites,
  type TimelinePingProjectionInput,
} from "domain/vesselOrchestration/shared";
