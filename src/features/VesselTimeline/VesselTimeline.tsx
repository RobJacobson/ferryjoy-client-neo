/**
 * Main VesselTimeline feature component.
 *
 * This component owns the vessel-day provider boundary and renders the
 * day-level timeline content from the normalized vessel-centric data source.
 */

import { useState } from "react";
import {
  createTimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "@/components/timeline";
import { VesselTimelineDataContainer } from "./components/VesselTimelineDataContainer";
import { VesselTimelineDataHost } from "./components/VesselTimelineDataHost";

type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};

/**
 * Public feature component for the vessel-day timeline.
 *
 * @param props - Vessel timeline props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.now - Optional wall-clock override for deterministic rendering
 * @returns Vessel-day timeline feature
 */
export const VesselTimeline = ({
  vesselAbbrev,
  sailingDay,
  now,
  theme,
}: VesselTimelineProps) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const resolvedTheme = createTimelineVisualTheme(theme);

  return (
    <VesselTimelineDataHost
      vesselAbbrev={vesselAbbrev}
      sailingDay={sailingDay}
      retryNonce={retryNonce}
      onRetry={() => {
        setRetryNonce((current) => current + 1);
      }}
    >
      <VesselTimelineDataContainer now={now} theme={resolvedTheme} />
    </VesselTimelineDataHost>
  );
};
