/**
 * Compatibility re-exports for schedule seeding during timeline module migration.
 */

export type { RawSeedSegment } from "../../timelineReseed/seedScheduledEvents";
export {
  buildSeedVesselTripEventsFromRawSegments,
  getDirectRawSeedSegments,
} from "../../timelineReseed/seedScheduledEvents";
