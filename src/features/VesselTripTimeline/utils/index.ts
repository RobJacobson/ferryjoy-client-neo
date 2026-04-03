/**
 * VesselTripTimeline utility exports.
 *
 * Single entry point: getTimelineRenderState runs the event-first pipeline
 * (timeline events → derived rows → active row → render rows → indicator).
 */

export { getTimelineRenderState } from "./pipeline";
