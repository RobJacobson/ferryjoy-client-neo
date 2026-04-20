/**
 * Per-tick writes for timeline tables (`eventsActual`, `eventsPredicted`) produced
 * after lifecycle persistence. Peers apply these via orchestrator mutations.
 *
 * Canonical definitions live in `domain/vesselOrchestration/shared`.
 */

export {
  mergePingEventWrites as mergeTickEventWrites,
  type PingEventWrites as TickEventWrites,
  type TimelinePingProjectionInput as TimelineTickProjectionInput,
} from "domain/vesselOrchestration/shared";
