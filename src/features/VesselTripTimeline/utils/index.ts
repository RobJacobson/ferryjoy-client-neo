/**
 * VesselTripTimeline utility exports.
 */

export { getLeftContentKind, getRightContentKind } from "./contentKinds";
export {
  deriveActiveOverlayIndicator,
  type OverlayIndicator,
} from "./deriveOverlayIndicator";
export { getMinutesUntilLabel } from "./indicatorLabels";
export {
  getGlobalPercentComplete,
  getRightTimePoint,
} from "./mapPresentationRowToTimelineRow";
export { getMarkerSourceForKind } from "./markerSource";
export {
  getTerminalNameAtDestination,
  getTerminalNameAtOrigin,
} from "./terminalLabels";
export { buildTimePoint } from "./timePointBuilders";
