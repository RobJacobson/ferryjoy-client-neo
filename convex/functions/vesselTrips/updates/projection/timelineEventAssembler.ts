/**
 * Assembles `TickEventWrites` from lifecycle facts and per-vessel messages.
 */

export {
  buildTickEventWritesFromCompletedFacts,
  buildTickEventWritesFromCurrentMessages,
} from "domain/vesselTrips/projection/timelineEventAssembler";
