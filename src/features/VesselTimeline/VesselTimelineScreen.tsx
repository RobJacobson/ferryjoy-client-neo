/**
 * Convenience screen wrapper for the VesselTimeline feature.
 */

import { VesselTimeline } from "./VesselTimeline";

type VesselTimelineScreenProps = {
  vesselAbbrev: string;
  sailingDay: string;
  routeAbbrevs: string[];
};

/**
 * Renders the vessel timeline as a full-screen feature.
 *
 * @param props - Screen props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.routeAbbrevs - Route abbreviations supplied by the caller
 * @returns Full-screen vessel timeline
 */
export const VesselTimelineScreen = ({
  vesselAbbrev,
  sailingDay,
  routeAbbrevs,
}: VesselTimelineScreenProps) => (
  <VesselTimeline
    vesselAbbrev={vesselAbbrev}
    sailingDay={sailingDay}
    routeAbbrevs={routeAbbrevs}
  />
);
