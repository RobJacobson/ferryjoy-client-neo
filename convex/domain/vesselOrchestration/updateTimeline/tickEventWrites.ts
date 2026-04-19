/**
 * Per-tick writes for timeline tables (`eventsActual`, `eventsPredicted`) produced
 * after lifecycle persistence. Peers apply these via orchestrator mutations.
 *
 * Canonical definitions live in `domain/vesselOrchestration/tickLifecycle`.
 */

export {
  mergeTickEventWrites,
  type TickEventWrites,
  type TimelineTickProjectionInput,
} from "domain/vesselOrchestration/tickLifecycle";
